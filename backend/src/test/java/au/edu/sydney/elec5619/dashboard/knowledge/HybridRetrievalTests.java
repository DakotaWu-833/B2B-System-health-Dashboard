package au.edu.sydney.elec5619.dashboard.knowledge;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.net.URI;
import java.time.Duration;
import java.util.*;
import au.edu.sydney.elec5619.dashboard.assistant.*;
import au.edu.sydney.elec5619.dashboard.infrastructure.RedisStore;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

class HybridRetrievalTests {
    @Test void semanticSearchRetrievesWithoutKeywordOverlapAndReusesOnlyUnchangedEmbeddings() {
        KnowledgeChunkRepository repository = mock(KnowledgeChunkRepository.class);
        RedisStore cache = mock(RedisStore.class);
        Map<String, String> values = new HashMap<>();
        when(cache.get(anyString())).thenAnswer(i -> Optional.ofNullable(values.get(i.getArgument(0))));
        doAnswer(i -> { values.put(i.getArgument(0), i.getArgument(1)); return null; }).when(cache).put(anyString(), anyString(), any());
        OllamaClient model = mock(OllamaClient.class);
        when(model.embed(anyList(), any())).thenAnswer(i -> {
            List<String> texts = i.getArgument(0);
            return texts.stream().map(text -> text.contains("unrelated") ? new double[]{0, 1} : new double[]{1, 0}).toList();
        });
        KnowledgeDocument document = new KnowledgeDocument(); document.id = 42L; document.version = 0;
        document.replace("运维手册", "先检查系统进程", 1L, true);
        when(repository.corpus(eq(true), eq(1L), any())).thenReturn(document.chunks);
        AiProperties ai = new AiProperties(true, URI.create("http://localhost:11434"), "test", "embedding", Duration.ofSeconds(2), 6);
        RetrievalService retrieval = new RetrievalService(repository, ai, model, cache, new ObjectMapper());
        var auth = new UsernamePasswordAuthenticationToken("ops", "", List.of(new SimpleGrantedAuthority("ROLE_OPERATIONS")));
        var result = retrieval.search("investigate processes", 1L, auth);
        assertThat(result.mode()).isEqualTo("hybrid"); assertThat(result.citations()).hasSize(1);
        assertThat(result.citations().getFirst().id()).isEqualTo("D42v0c0");
        retrieval.search("investigate processes", 1L, auth);
        verify(model, times(1)).embed(anyList(), any());
        document.replace("运维手册", "检查内存使用率", 1L, true); document.version = 1;
        when(repository.corpus(eq(true), eq(1L), any())).thenReturn(document.chunks);
        assertThat(retrieval.search("investigate processes", 1L, auth).citations().getFirst().version()).isEqualTo(1);
        verify(model, times(2)).embed(anyList(), any());
    }
    @Test void unavailableEmbeddingsFallBackToLexicalEvidence() {
        KnowledgeChunkRepository repository = mock(KnowledgeChunkRepository.class);
        RedisStore cache = mock(RedisStore.class); when(cache.get(anyString())).thenReturn(Optional.empty());
        OllamaClient model = mock(OllamaClient.class); when(model.embed(anyList(), any())).thenThrow(new OllamaClient.ModelUnavailableException());
        KnowledgeDocument doc = new KnowledgeDocument(); doc.id = 1L; doc.replace("CPU", "Inspect CPU processes", null, false);
        when(repository.corpus(anyBoolean(), isNull(), any())).thenReturn(doc.chunks);
        var retrieval = new RetrievalService(repository, new AiProperties(true, URI.create("http://localhost:11434"), "test", "embedding", Duration.ofSeconds(2), 6), model, cache, new ObjectMapper());
        var result = retrieval.search("CPU", null, new UsernamePasswordAuthenticationToken("m", "", List.of()));
        assertThat(result.mode()).isEqualTo("bm25_embedding_unavailable"); assertThat(result.citations()).hasSize(1);
    }
}
