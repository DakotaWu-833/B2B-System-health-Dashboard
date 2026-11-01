package au.edu.sydney.elec5619.dashboard.assistant;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.math.BigInteger;
import org.springframework.stereotype.Component;

/**
 * Deterministic checks for a deliberately limited set of operational assertions.
 * This is not a general semantic/entailment verifier. Only structured server
 * fields are facts: source excerpts, descriptions, messages and instructions
 * are never parsed as rules or as JSON containing additional facts.
 */
@Component
public class OperationalAnswerGuard {
    private static final String NUMBER = "(?<![a-z\\d.])(\\d+)(?!\\d|\\.\\d|\\s*[%％])";
    private static final Pattern NEGATION = Pattern.compile(
            "\\b(?:not|no|never|cannot|can't|isn't|aren't|wasn't|weren't|doesn't|don't|without)\\b"
                    + "|并非|不是|不能|无法|未能|并不|不代表|不意味着|不等于|尚未|未确认|不一定|不说明|不表示|不能说明");
    private static final Pattern HISTORICAL = Pattern.compile(
            "\\b(?:last[ -](?:reported|known)|previously|historical|past|formerly)\\b|最后(?:一次)?(?:上报|报告|记录)|上次|历史|此前|曾经");
    private static final Pattern NON_ASSERTIVE = Pattern.compile(
            "\\b(?:whether|if|unless|check|verify|determine|investigate|could|might|may|should|would)\\b|是否|如果|假如|可能|检查|核实|确认是否|建议");
    private static final Pattern FRESH_ASSERTION = Pattern.compile(
            "\\b(?:data freshness|freshness of (?:the )?(?:data|readings|measurements))\\s+(?:is\\s+)?(?:confirmed|verified|established)\\b"
                    + "|\\b(?:all |the |current )?(?:data|readings|measurements|metrics)\\s+(?:is|are|remains?)\\s+(?:all |currently |confirmed |verified |not )*(?:fresh|up[ -]to[ -]date|real[ -]time|current)\\b"
                    + "|\\b(?:all |the )?fresh (?:data|readings|measurements)\\s+(?:is|are)\\s+(?:confirmed|available)\\b"
                    + "|(?:数据|读数|指标)(?:的)?新鲜度(?:已|已经)?(?:确认|验证)"
                    + "|(?:所有|全部|当前|这些)?(?:监控)?(?:数据|读数|指标)(?:都|均)?(?:是|为|已|已经)?(?:最新|实时|新鲜|及时更新)");
    private static final Pattern WORKFLOW_RECOVERY = Pattern.compile(
            "\\b(?:acknowledged|acknowledg(?:e)?ment|acknowledging|resolved|resolution|resolving)\\b.{0,60}"
                    + "\\b(?:means?|proves?|confirms?|indicates?|demonstrates?|equals?|is|are)\\b.{0,60}"
                    + "\\b(?:recover(?:ed|y)|restored|healthy|back online|operational)\\b"
                    + "|(?:已确认|确认告警|告警确认|已认领|已应答|已解决|解决告警|告警解决).{0,24}"
                    + "(?:说明|意味|证明|代表|等于|表明|表示).{0,24}(?:恢复|健康|正常|可用|修复)");
    private static final Pattern MISSING_IS_DOWN = Pattern.compile(
            "\\b(?:stale|outdated|missing|no data|no readings)\\b.{0,50}"
                    + "\\b(?:means?|proves?|confirms?|indicates?|equals?)\\b.{0,50}\\b(?:down|offline|unavailable|outage|downtime)\\b"
                    + "|(?:数据过期|过期数据|没有数据|无数据|无读数|读数缺失|数据缺失|数据陈旧).{0,24}"
                    + "(?:说明|意味|证明|代表|等于|表明|表示).{0,24}(?:宕机|停机|离线|不可用)");
    private static final Pattern ALL_HEALTHY = Pattern.compile(
            "\\ball (?:the )?systems (?:are|remain) (?:currently )?healthy\\b|(?:所有|全部)系统(?:都|均)?(?:是|为|已)?健康");
    private static final Pattern ASSERTED_STATE = Pattern.compile(
            "(?:\\b(?:the |this |selected )?(?:system|service|server|it)\\s+(?:is|remains|has become|has recovered|has been restored)\\s*(?:currently |now |already |not )*)"
                    + "(healthy|warning|critical|offline|down|up|available|unavailable|recovered|operational)\\b"
                    + "|(?:系统|服务|服务器|它)(?:当前|目前|现在)?(?:已经|已|是|为|处于|仍然|运行)?(?:当前|目前|现在)?"
                    + "(健康|告警|严重|宕机|停机|离线|不可用|可用|恢复正常|已恢复|正常)");
    private static final Pattern RECOVERED_STATE = Pattern.compile(
            "\\b(?:the |this |selected )?(?:system|service|server|it)\\s+has\\s+(?:already )?(?:recovered|been restored)\\b"
                    + "|(?:系统|服务|服务器|它)(?:当前|目前|现在)?(?:已经|已)(?:恢复|修复)");
    private static final Map<String, String[]> COUNTS = Map.ofEntries(
            Map.entry("healthy", new String[]{"healthy", "健康"}),
            Map.entry("warning", new String[]{"warning", "警告|预警"}),
            Map.entry("critical", new String[]{"critical", "严重|危急"}),
            Map.entry("offline", new String[]{"offline", "离线"}),
            Map.entry("noData", new String[]{"(?:no[ -]data|without data|with no data)", "无数据|没有数据"}),
            Map.entry("freshReadingCount", new String[]{"(?:fresh readings?|fresh measurements?)", "新鲜读数|有效读数|最新读数"}),
            Map.entry("staleReadingCount", new String[]{"(?:stale readings?|outdated readings?)", "过期读数|陈旧读数"}),
            Map.entry("activeAlertCount", new String[]{"active alerts?", "活动告警|未确认告警"}));
    private final ObjectMapper mapper;

    public OperationalAnswerGuard(ObjectMapper mapper) { this.mapper = mapper; }

    /** Canonical facts for the prompt and the deterministic checks, not model-supplied facts. */
    public JsonNode facts(List<AssistantObservation> observations) {
        ObjectNode result = mapper.createObjectNode();
        ArrayNode dashboards = result.putArray("dashboards");
        ArrayNode systems = result.putArray("systems");
        ArrayNode alerts = result.putArray("alerts");
        if (observations == null) return result;
        for (AssistantObservation observation : observations) {
            if (observation == null || observation.data() == null) continue;
            JsonNode value = mapper.valueToTree(observation.data());
            collect(value, observation.id(), dashboards, systems, alerts);
            // Only the known paginated API envelope is traversed, never arbitrary nested objects.
            if (value.isObject() && value.path("items").isArray() && value.has("totalElements")) {
                for (JsonNode item : value.path("items")) collect(item, observation.id(), dashboards, systems, alerts);
            }
        }
        return result;
    }

    private void collect(JsonNode value, String evidenceId, ArrayNode dashboards, ArrayNode systems, ArrayNode alerts) {
        if (!value.isObject()) return;
        if (isCount(value, "total") && isCount(value, "healthy") && isCount(value, "warning")
                && isCount(value, "critical") && isCount(value, "offline") && isCount(value, "activeAlertCount")) {
            ObjectNode fact = dashboards.addObject(); fact.put("evidenceId", evidenceId);
            for (String key : List.of("total", "healthy", "warning", "critical", "offline", "noData",
                    "activeAlertCount", "freshReadingCount", "staleReadingCount")) {
                if (isCount(value, key)) fact.set(key, value.get(key));
            }
        }
        String freshness = text(value, "measurementFreshness", "metricDataStatus");
        if (List.of("FRESH", "STALE", "NO_DATA").contains(freshness)
                && (value.path("id").isIntegralNumber() || value.path("systemId").isIntegralNumber())) {
            ObjectNode fact = systems.addObject(); fact.put("evidenceId", evidenceId);
            fact.put("systemId", value.has("systemId") ? value.path("systemId").asLong() : value.path("id").asLong());
            fact.put("name", value.path("name").asText(""));
            fact.put("measurementFreshness", freshness);
            fact.put("lastReportedHealthStatus", text(value, "lastReportedHealthStatus", "status"));
            String availability = "UNKNOWN";
            if (freshness.equals("FRESH")) {
                String explicit = value.path("currentAvailability").asText("");
                JsonNode reading = value.has("lastReportedReading") ? value.path("lastReportedReading") : value.path("latestMetric");
                if (List.of("AVAILABLE", "UNAVAILABLE").contains(explicit)) availability = explicit;
                else if (reading.path("availability").isBoolean()) availability = reading.path("availability").asBoolean() ? "AVAILABLE" : "UNAVAILABLE";
            }
            fact.put("currentAvailability", availability);
        }
        String workflow = text(value, "currentWorkflowStatus", "status");
        if (value.path("alertId").isIntegralNumber() && List.of("ACTIVE", "ACKNOWLEDGED", "RESOLVED").contains(workflow)) {
            ObjectNode fact = alerts.addObject(); fact.put("evidenceId", evidenceId);
            fact.put("alertId", value.path("alertId").asLong()); fact.put("currentWorkflowStatus", workflow);
        }
    }

    public boolean accepts(String text, List<AssistantObservation> observations) {
        if (text == null || text.isBlank()) return false;
        JsonNode facts = facts(observations);
        String normalized = text.toLowerCase(Locale.ROOT).replace('’', '\'');
        JsonNode dashboard = facts.path("dashboards").isEmpty() ? null : facts.path("dashboards").get(0);
        if (dashboard != null && contradictsCounts(normalized, dashboard)) return false;
        // A historical/negative first statement must not exempt a later assertion.
        for (String clause : normalized.split("(?<=[.!?;\\n。！？；])|,?\\s+\\b(?:but|however|yet|whereas)\\b\\s*|\\s+and\\s+(?=(?:the|this|selected)\\s+(?:system|service|server)\\b)|但是|然而|不过|但")) {
            if (clause.strip().endsWith("?") || clause.strip().endsWith("？")) continue;
            if (asserts(WORKFLOW_RECOVERY, clause) || asserts(MISSING_IS_DOWN, clause)) return false;
            if (asserts(FRESH_ASSERTION, clause) && !allReadingsKnownFresh(facts)) return false;
            if (asserts(ALL_HEALTHY, clause) && (dashboard == null || dashboard.path("total").asLong() != dashboard.path("healthy").asLong()
                    || !allReadingsKnownFresh(facts))) return false;
            if (contradictsSystemState(clause, facts.path("systems"))) return false;
        }
        return true;
    }

    private boolean contradictsCounts(String text, JsonNode dashboard) {
        for (var entry : COUNTS.entrySet()) {
            if (!dashboard.has(entry.getKey())) continue;
            String english = entry.getValue()[0], chinese = entry.getValue()[1];
            List<Pattern> patterns = new ArrayList<>(List.of(
                    Pattern.compile(NUMBER + "\\s+(?:systems?\\s+(?:are\\s+)?)?(?:" + english + ")(?!\\s+alerts?\\b)\\b"),
                    Pattern.compile("\\b(?:" + english + ")(?:\\s+systems?)?\\s*(?::|=|is|are|count(?: is)?|number(?: is)?)\\s*" + NUMBER),
                    Pattern.compile(NUMBER + "\\s*(?:个|台)?\\s*(?:系统)?(?:为|处于)?(?:" + chinese + ")"),
                    Pattern.compile("(?:" + chinese + ")(?:系统|的系统)?(?:数量|数)?(?:为|是|有|：|:|=)?\\s*" + NUMBER)));
            for (Pattern pattern : patterns) {
                Matcher matcher = pattern.matcher(text);
                while (matcher.find()) {
                    // "no data" is the category label, not a negation of this count.
                    if (!negatedCount(text, matcher.start()) && !sameCount(matcher.group(1), dashboard.path(entry.getKey()).asLong())) return true;
                }
            }
        }
        for (Pattern pattern : List.of(
                Pattern.compile("\\btotal(?: of)?\\s+" + NUMBER + "\\s+systems?\\b"),
                Pattern.compile(NUMBER + "\\s+(?:total systems?|systems? in total)\\b"),
                Pattern.compile("\\btotal systems?\\s*(?::|=|is|are)\\s*" + NUMBER),
                Pattern.compile("(?:总共|总计|共有|共)\\s*" + NUMBER + "\\s*(?:个|台)?系统"),
                Pattern.compile("系统总数(?:为|是|：|:)?\\s*" + NUMBER))) {
            Matcher matcher = pattern.matcher(text);
            while (matcher.find()) if (!negatedCount(text, matcher.start())
                    && !sameCount(matcher.group(1), dashboard.path("total").asLong())) return true;
        }
        return false;
    }

    private boolean contradictsSystemState(String clause, JsonNode systems) {
        Matcher recovered = RECOVERED_STATE.matcher(clause);
        while (recovered.find()) {
            if (!qualified(clause, recovered.start(), recovered.end())) return true;
        }
        Matcher matcher = ASSERTED_STATE.matcher(clause);
        while (matcher.find()) {
            if (contextQualified(clause, matcher.start(), matcher.end())) continue;
            String state = matcher.group(1) == null ? matcher.group(2) : matcher.group(1);
            boolean negativeState = Pattern.compile("\\bnot\\b").matcher(matcher.group()).find();
            // A single current snapshot cannot establish a transition/recovery.
            if (List.of("recovered", "恢复正常", "已恢复").contains(state)) return true;
            boolean matchedSystem = false;
            for (JsonNode system : systems) {
                // A named multi-system answer is checked against its named record only.
                String name = system.path("name").asText().toLowerCase(Locale.ROOT);
                if (systems.size() > 1 && (name.isBlank() || !clause.contains(name))) continue;
                matchedSystem = true;
                String availability = system.path("currentAvailability").asText();
                if (availability.equals("UNKNOWN")) return true;
                boolean down = List.of("offline", "down", "unavailable", "宕机", "停机", "离线", "不可用").contains(state);
                String health = List.of("healthy", "健康").contains(state) ? "HEALTHY"
                        : List.of("warning", "告警").contains(state) ? "WARNING"
                        : List.of("critical", "严重").contains(state) ? "CRITICAL" : null;
                if (health != null) {
                    if (negativeState == system.path("lastReportedHealthStatus").asText().equals(health)) return true;
                    if (!negativeState && availability.equals("UNAVAILABLE")) return true;
                } else if (negativeState == (down == availability.equals("UNAVAILABLE"))) return true;
            }
            if (!matchedSystem) return true;
        }
        return false;
    }

    private boolean allReadingsKnownFresh(JsonNode facts) {
        boolean known = false;
        for (JsonNode dashboard : facts.path("dashboards")) {
            if (!dashboard.has("freshReadingCount") || !dashboard.has("staleReadingCount") || !dashboard.has("noData")) return false;
            if (dashboard.path("total").asLong() == 0 || dashboard.path("freshReadingCount").asLong() == 0
                    || dashboard.path("staleReadingCount").asLong() > 0 || dashboard.path("noData").asLong() > 0) return false;
            known = true;
        }
        for (JsonNode system : facts.path("systems")) {
            if (!system.path("measurementFreshness").asText().equals("FRESH")) return false;
            known = true;
        }
        return known;
    }

    private static boolean asserts(Pattern pattern, String text) {
        Matcher matcher = pattern.matcher(text);
        while (matcher.find()) if (!qualified(text, matcher.start(), matcher.end())) return true;
        return false;
    }
    private static boolean negated(String text, int start, int end) {
        return NEGATION.matcher(withoutCategoryLabels(text.substring(Math.max(0, start - 12), end))).find();
    }
    private static boolean qualified(String text, int start, int end) {
        return negated(text, start, end) || contextQualified(text, start, end);
    }
    private static boolean contextQualified(String text, int start, int end) {
        String prefix = text.substring(Math.max(0, start - 48), start);
        prefix = prefix.substring(Math.max(prefix.lastIndexOf(','), prefix.lastIndexOf('，')) + 1);
        String assertion = text.substring(start, end);
        boolean explicitlyCurrent = assertion.matches("(?s).*\\b(?:currently|now)\\b.*")
                || assertion.contains("当前") || assertion.contains("目前") || assertion.contains("现在");
        return NEGATION.matcher(withoutCategoryLabels(prefix)).find() || (!explicitlyCurrent && HISTORICAL.matcher(prefix).find())
                || NON_ASSERTIVE.matcher(prefix).find();
    }
    private static boolean negatedCount(String text, int start) {
        String prefix = text.substring(Math.max(0, start - 12), start);
        int boundary = Math.max(Math.max(prefix.lastIndexOf('.'), prefix.lastIndexOf(';')), prefix.lastIndexOf('。'));
        prefix = prefix.substring(boundary + 1).replaceAll("\\bno[ -]data\\b|\\bwith no data\\b", "");
        return NEGATION.matcher(prefix).find();
    }
    private static boolean sameCount(String number, long expected) {
        // Model text is untrusted; arbitrarily large integers must never cause a 500.
        return number.length() <= 19 && new BigInteger(number).equals(BigInteger.valueOf(expected));
    }
    private static String withoutCategoryLabels(String text) {
        return text.replaceAll("\\bno[ -]data\\b|\\bno readings\\b", "missing measurements");
    }
    private static boolean isCount(JsonNode value, String field) { return value.path(field).isIntegralNumber() && value.path(field).asLong() >= 0; }
    private static String text(JsonNode value, String preferred, String fallback) {
        return value.hasNonNull(preferred) ? value.path(preferred).asText("") : value.path(fallback).asText("");
    }
}
