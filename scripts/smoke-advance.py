"""Live, loopback-only smoke test. Use a disposable database; synthetic fixtures remain for review."""
import concurrent.futures
import http.cookiejar
import json
import os
from pathlib import Path
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = os.environ.get("ADVANCE_BASE_URL", "http://127.0.0.1:8080").rstrip("/")
if urllib.parse.urlparse(BASE).hostname not in {"127.0.0.1", "localhost", "::1"}:
    raise SystemExit("This fixture-writing test is limited to a local disposable environment.")
PASSWORDS = {role: os.environ.get(f"ADVANCE_{role.upper()}_PASSWORD") for role in ("operations", "management")}
if not all(PASSWORDS.values()):
    raise SystemExit("Set ADVANCE_OPERATIONS_PASSWORD and ADVANCE_MANAGEMENT_PASSWORD through the environment.")
CHECKS = []


def check(condition, description):
    if not condition:
        raise AssertionError(description)
    CHECKS.append(description)
    print("PASS", description, flush=True)


class Client:
    def __init__(self):
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def request(self, path, method="GET", body=None, csrf=True):
        headers = {"Content-Type": "application/json"}
        if method != "GET" and csrf:
            _, token, _ = self.request("/api/auth/csrf")
            headers[token["data"]["headerName"]] = token["data"]["token"]
        request = urllib.request.Request(BASE + path, method=method, headers=headers,
                                         data=None if body is None else json.dumps(body).encode())
        try:
            with self.opener.open(request, timeout=160) as response:
                return response.status, json.load(response), dict(response.headers)
        except urllib.error.HTTPError as error:
            return error.code, json.load(error), dict(error.headers)

    def login(self, role):
        username = os.environ.get(f"ADVANCE_{role.upper()}_USERNAME", f"demo.{role}")
        status, _, _ = self.request("/api/auth/login", "POST", {"username": username, "password": PASSWORDS[role]})
        if status != 200:
            raise AssertionError(f"Login failed for {role} (HTTP {status}); credentials were not logged.")


operations, management, anonymous = Client(), Client(), Client()
operations.login("operations")
management.login("management")
check(anonymous.request("/api/assistant/status")[0] == 401, "anonymous rejected")
status, payload, _ = operations.request("/api/systems", "POST", {
    "name": "Synthetic AI smoke " + str(time.time_ns()), "type": "SERVICE",
    "host": "synthetic-ai-smoke.local", "description": "Synthetic live verification fixture"})
check(status == 201, "create isolated monitored system")
system_id = payload["data"]["id"]
status, _, _ = operations.request(f"/api/systems/{system_id}/metrics", "POST", {
    "cpuUsage": 95, "memoryUsage": 40, "responseTime": 120, "availability": True})
check(status == 201, "real metric ingestion")
_, payload, _ = operations.request(f"/api/alerts?systemId={system_id}&size=10")
alert_id = payload["data"]["items"][0]["alertId"]
status, document, headers = operations.request("/api/knowledge/documents", "POST", {
    "title": "CPU investigation example (synthetic)", "systemId": system_id, "operationsOnly": True,
    "content": "For a high CPU alert, inspect process CPU usage and recent deployments. Confirm data freshness before diagnosing. "
               "Acknowledge means an operator has taken ownership; it does not prove recovery. Example incident only."})
check(status == 200 and document["data"]["chunkCount"] == 1, "persisted and indexed runbook")
check(headers.get("Cache-Control") == "private, no-store" and bool(headers.get("X-Request-ID")), "private response and request trace")
check(management.request(f"/api/knowledge/documents/{document['data']['id']}")[0] == 404, "private sources hidden from management")
question = {"question": "What should we inspect for high CPU and what does acknowledgment mean?", "systemId": system_id}
check(operations.request("/api/assistant/ask", "POST", question, csrf=False)[0] == 403, "CSRF required for inference")
status, answer, _ = operations.request("/api/assistant/ask", "POST", question)
check(status == 200 and answer["data"]["retrievalMode"] == "hybrid", "real embedding hybrid retrieval")
check(answer["data"]["status"] == "generated_with_sources" and bool(answer["data"]["answer"]), "model answer with valid source references")
status, report, _ = operations.request("/api/assistant/diagnose", "POST", {
    "question": f"Please inspect current metrics and alerts, search the CPU runbook, then propose ACKNOWLEDGE for alert {alert_id} "
                "so I can take ownership. Do not resolve it.", "systemId": system_id})
check(status == 200, "real model investigation response")
report = report["data"]
check(report["status"] == "completed", "model finishes bounded tool loop")
tools = [step["tool"] for step in report["trace"]]
check("query_metrics" in tools and "search_runbooks" in tools, "model selected metric and runbook tools")
_, before, _ = operations.request(f"/api/alerts?systemId={system_id}&size=10")
check(before["data"]["items"][0]["status"] == "ACTIVE", "agent did not mutate alert")
check(len(report["proposals"]) == 1, "model produced pending acknowledgment")
proposal_id = report["proposals"][0]["id"]
path = f"/api/assistant/proposals/{proposal_id}/confirm"
check(management.request(path, "POST")[0] == 403, "management cannot confirm proposal")
second = Client()
second.login("operations")
with concurrent.futures.ThreadPoolExecutor(2) as pool:
    results = [future.result() for future in [pool.submit(client.request, path, "POST") for client in (operations, second)]]
check(all(result[0] == 200 and result[1]["data"]["status"] == "ACKNOWLEDGED" for result in results), "concurrent confirmation returns same committed result")
_, after, _ = operations.request(f"/api/alerts?systemId={system_id}&size=10")
check(after["data"]["items"][0]["status"] == "ACKNOWLEDGED", "confirmed alert persisted")
result_path = Path(os.environ.get("ADVANCE_SMOKE_OUTPUT", "backend/target/advance-smoke.json"))
result_path.parent.mkdir(parents=True, exist_ok=True)
result_path.write_text(json.dumps({"checks": CHECKS, "systemId": system_id, "documentId": document["data"]["id"],
                                   "ragStatus": answer["data"]["status"], "agentStatus": report["status"], "tools": tools}, indent=2), encoding="utf-8")
print(f"All {len(CHECKS)} live checks passed. Synthetic system #{system_id} remains for review.")
