package au.edu.sydney.elec5619.dashboard.assistant;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import java.net.URI;
import java.time.*;
import java.util.*;
import au.edu.sydney.elec5619.dashboard.knowledge.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

class RagDeadlineTests {
    @Test void retrievalTimeComesOutOfTheGenerationBudget() throws Exception {
        var retrieval = mock(RetrievalService.class); var knowledge = mock(KnowledgeService.class);
        var model = mock(OllamaClient.class); var mapper = new ObjectMapper();
        var auth = new UsernamePasswordAuthenticationToken("ops", "");
        var evidence = new RetrievalService.Result("hybrid", List.of(new KnowledgeService.Citation("D1v0c0", 1L, 0, 0, "CPU", "Inspect CPU", "/api/knowledge/documents/1", 1)));
        when(retrieval.search(eq("CPU"), isNull(), eq(auth), any())).thenAnswer(i -> { Thread.sleep(100); return evidence; });
        when(knowledge.current(anyList(), eq(auth))).thenReturn(true);
        when(model.chat(anyList(), anyList(), eq(true), any())).thenReturn(mapper.readTree("{\"content\":\"{\\\"answer\\\":\\\"Inspect CPU\\\",\\\"citationIds\\\":[\\\"D1v0c0\\\"]}\"}"));
        var rag = new RagService(retrieval, knowledge, model, new AiProperties(true, URI.create("http://localhost"), "test", "", Duration.ofSeconds(2), 6), mapper);
        assertThat(rag.ask("CPU", null, auth).status()).isEqualTo("generated_with_sources");
        var remaining = ArgumentCaptor.forClass(Duration.class);
        verify(model).chat(anyList(), anyList(), eq(true), remaining.capture());
        assertThat(remaining.getValue()).isPositive().isLessThan(Duration.ofMillis(1950));
    }
    @Test void anExpiredRetrievalBudgetSkipsGenerationAndReturnsOriginalEvidence() throws Exception {
        var retrieval = mock(RetrievalService.class); var knowledge = mock(KnowledgeService.class); var model = mock(OllamaClient.class);
        var auth = new UsernamePasswordAuthenticationToken("ops", "");
        var citations = List.of(new KnowledgeService.Citation("D1v0c0", 1L, 0, 0, "CPU", "Inspect CPU", "/api/knowledge/documents/1", 1));
        when(retrieval.search(anyString(), isNull(), eq(auth), any())).thenAnswer(i -> {
            Thread.sleep(1050); return new RetrievalService.Result("bm25_embedding_unavailable", citations);
        });
        when(knowledge.current(citations, auth)).thenReturn(true);
        var rag = new RagService(retrieval, knowledge, model, new AiProperties(true, URI.create("http://localhost"), "test", "", Duration.ofSeconds(1), 6), new ObjectMapper());
        var answer = rag.ask("CPU", null, auth);
        assertThat(answer.status()).isEqualTo("model_timeout"); assertThat(answer.answer()).isNull();
        assertThat(answer.citations()).isEqualTo(citations); verifyNoInteractions(model);
    }
}
