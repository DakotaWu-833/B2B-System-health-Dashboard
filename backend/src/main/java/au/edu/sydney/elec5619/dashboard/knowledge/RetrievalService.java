package au.edu.sydney.elec5619.dashboard.knowledge;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import java.util.regex.Pattern;
import au.edu.sydney.elec5619.dashboard.assistant.*;
import au.edu.sydney.elec5619.dashboard.infrastructure.RedisStore;
import au.edu.sydney.elec5619.dashboard.common.ApiProblemException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

@Service
public class RetrievalService {
    public record Result(String mode, List<KnowledgeService.Citation> citations) {}
    private static final Pattern TOKENS = Pattern.compile("[\\p{L}\\p{N}_]+", Pattern.UNICODE_CHARACTER_CLASS);
    private final KnowledgeChunkRepository chunks;
    private final AiProperties ai;
    private final OllamaClient model;
    private final RedisStore redis;
    private final ObjectMapper mapper;
    public RetrievalService(KnowledgeChunkRepository chunks, AiProperties ai, OllamaClient model,
                            RedisStore redis, ObjectMapper mapper) {
        this.chunks = chunks; this.ai = ai; this.model = model; this.redis = redis; this.mapper = mapper;
    }
    public Result search(String query, Long systemId, Authentication auth) {
        return search(query, systemId, auth, Instant.now().plus(ai.timeout()));
    }
    public Result search(String query, Long systemId, Authentication auth, Instant requestDeadline) {
        List<KnowledgeChunk> corpus = chunks.corpus(KnowledgeService.operations(auth), systemId, PageRequest.of(0, 1001));
        if (corpus.size() > 1000) throw new ApiProblemException(HttpStatus.UNPROCESSABLE_ENTITY,
                "Knowledge scope exceeds 1000 chunks. Select a system or reduce the corpus.");
        if (corpus.isEmpty()) return new Result("bm25", List.of());
        List<Map<String, Long>> terms = corpus.stream().map(c -> frequencies(c.document.title + " " + c.text)).toList();
        Set<String> wanted = frequencies(query).keySet();
        double average = terms.stream().mapToDouble(t -> t.values().stream().mapToLong(Long::longValue).sum()).average().orElse(1);
        Map<String, Long> documentFrequency = new HashMap<>();
        terms.forEach(t -> t.keySet().forEach(word -> documentFrequency.merge(word, 1L, Long::sum)));
        Map<Integer, Double> lexical = new HashMap<>();
        for (int i = 0; i < terms.size(); i++) {
            Map<String, Long> t = terms.get(i);
            double length = t.values().stream().mapToLong(Long::longValue).sum();
            double score = 0;
            for (String word : wanted) {
                double tf = t.getOrDefault(word, 0L);
                if (tf == 0) continue;
                double df = documentFrequency.get(word);
                double idf = Math.log(1 + (corpus.size() - df + 0.5) / (df + 0.5));
                score += idf * tf * 2.2 / (tf + 1.2 * (0.25 + 0.75 * length / average));
            }
            if (score > 0) lexical.put(i, score);
        }
        Map<Integer, Double> fused = new HashMap<>();
        addRanks(fused, lexical);
        String mode = "bm25";
        if (ai.enabled() && !ai.embeddingModel().isBlank() && corpus.size() <= 256) {
            try {
                Instant perCallDeadline = Instant.now().plus(ai.timeout());
                Instant deadline = requestDeadline.isBefore(perCallDeadline) ? requestDeadline : perCallDeadline;
                List<String> texts = new ArrayList<>(List.of(query));
                corpus.forEach(c -> texts.add(c.document.title + "\n" + c.text));
                List<double[]> vectors = embeddings(texts, deadline);
                Map<Integer, Double> semantic = new HashMap<>();
                for (int i = 0; i < corpus.size(); i++) {
                    double similarity = cosine(vectors.getFirst(), vectors.get(i + 1));
                    if (similarity >= 0.5) semantic.put(i, similarity);
                }
                addRanks(fused, semantic); mode = "hybrid";
            } catch (Exception unavailable) { mode = "bm25_embedding_unavailable"; }
        }
        List<KnowledgeService.Citation> citations = ranked(fused).stream().limit(5).map(i -> {
            KnowledgeChunk c = corpus.get(i); KnowledgeDocument d = c.document;
            String id = "D" + d.id + "v" + d.version + "c" + c.position;
            return new KnowledgeService.Citation(id, d.id, d.version, c.position, d.title, c.text,
                    "/api/knowledge/documents/" + d.id, fused.get(i));
        }).toList();
        return new Result(mode, citations);
    }
    private List<double[]> embeddings(List<String> texts, Instant deadline) throws Exception {
        List<double[]> result = new ArrayList<>(Collections.nCopies(texts.size(), null));
        List<Integer> missing = new ArrayList<>();
        for (int i = 0; i < texts.size(); i++) {
            if (!Instant.now().isBefore(deadline)) throw new OllamaClient.ModelTimeoutException();
            var raw = redis.get(embeddingKey(texts.get(i)));
            if (raw.isPresent()) {
                try {
                    double[] vector = mapper.readValue(raw.get(), double[].class);
                    if (vector.length > 0 && vector.length <= 8192 && Arrays.stream(vector).allMatch(Double::isFinite)) result.set(i, vector);
                } catch (Exception invalid) { /* Replace corrupt cache data from the model. */ }
            }
            if (result.get(i) == null) missing.add(i);
        }
        for (int start = 0; start < missing.size(); start += 32) {
            if (!Instant.now().isBefore(deadline)) throw new OllamaClient.ModelTimeoutException();
            List<Integer> positions = missing.subList(start, Math.min(missing.size(), start + 32));
            List<double[]> values = model.embed(positions.stream().map(texts::get).toList(), Duration.between(Instant.now(), deadline));
            for (int i = 0; i < positions.size(); i++) {
                int position = positions.get(i); result.set(position, values.get(i));
                if (Instant.now().isBefore(deadline)) redis.put(embeddingKey(texts.get(position)), mapper.writeValueAsString(values.get(i)), Duration.ofDays(7));
            }
        }
        return result;
    }
    private String embeddingKey(String text) { return "embedding:" + hash(ai.baseUrl() + "|" + ai.embeddingModel() + "|" + text); }
    private static void addRanks(Map<Integer, Double> output, Map<Integer, Double> scores) {
        List<Integer> ranked = ranked(scores);
        for (int i = 0; i < ranked.size(); i++) output.merge(ranked.get(i), 1.0 / (60 + i + 1), Double::sum);
    }
    private static List<Integer> ranked(Map<Integer, Double> scores) {
        return scores.keySet().stream().sorted(Comparator.<Integer>comparingDouble(scores::get).reversed().thenComparingInt(i -> i)).toList();
    }
    static Map<String, Long> frequencies(String text) {
        Map<String, Long> result = new HashMap<>();
        var matcher = TOKENS.matcher(text.toLowerCase(Locale.ROOT));
        while (matcher.find()) {
            String word = matcher.group(); result.merge(word, 1L, Long::sum);
            int[] chars = word.codePoints().toArray();
            for (int i = 0; i < chars.length; i++) {
                if (Character.UnicodeScript.of(chars[i]) == Character.UnicodeScript.HAN) {
                    result.merge(new String(chars, i, 1), 1L, Long::sum);
                    if (i + 1 < chars.length && Character.UnicodeScript.of(chars[i + 1]) == Character.UnicodeScript.HAN)
                        result.merge(new String(chars, i, 2), 1L, Long::sum);
                }
            }
        }
        return result;
    }
    private static double cosine(double[] a, double[] b) {
        if (a.length != b.length) return -1;
        double dot = 0, aa = 0, bb = 0;
        for (int i = 0; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
        return aa == 0 || bb == 0 ? -1 : dot / Math.sqrt(aa * bb);
    }
    public static String hash(String text) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8))); }
        catch (Exception impossible) { throw new IllegalStateException(impossible); }
    }
}
