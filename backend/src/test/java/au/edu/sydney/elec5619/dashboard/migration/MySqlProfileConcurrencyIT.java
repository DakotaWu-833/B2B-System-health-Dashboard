package au.edu.sydney.elec5619.dashboard.migration;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.Pattern;
import java.util.function.Supplier;
import au.edu.sydney.elec5619.dashboard.user.*;
import au.edu.sydney.elec5619.dashboard.profile.EmailVerificationRepository;
import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.*;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.*;
@Testcontainers @SpringBootTest(properties={"spring.flyway.baseline-on-migrate=false"}) @AutoConfigureMockMvc
class MySqlProfileConcurrencyIT {
    @Container @ServiceConnection static final MySQLContainer<?> MYSQL=new MySQLContainer<>("mysql:8.4");
    @Container static final GenericContainer<?> MAIL=new GenericContainer<>("axllent/mailpit:v1.31.6")
        .withExposedPorts(1025,8025).waitingFor(Wait.forHttp("/").forPort(8025));
    @DynamicPropertySource static void smtp(DynamicPropertyRegistry registry) {
        registry.add("spring.mail.host",MAIL::getHost); registry.add("spring.mail.port",() -> MAIL.getMappedPort(1025));
        registry.add("app.email.enabled",() -> true);
    }
    @Autowired MockMvc mvc; @Autowired ObjectMapper json; @Autowired UserRepository users; @Autowired EmailVerificationRepository verifications;
    final HttpClient client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
    String mailUrl(String path) { return "http://"+MAIL.getHost()+":"+MAIL.getMappedPort(8025)+path; }
    @BeforeEach void clear() throws Exception {
        verifications.deleteAll(); users.deleteAll();
        users.saveAndFlush(new User("mail.owner","test-hash",Role.OPERATIONS));
        users.saveAndFlush(new User("mail.other","test-hash",Role.MANAGEMENT));
        client.send(HttpRequest.newBuilder(URI.create(mailUrl("/api/v1/messages"))).DELETE().build(),HttpResponse.BodyHandlers.discarding());
    }
    int update(String user,String email) throws Exception {
        return mvc.perform(put("/api/profile").with(user(user).roles("OPERATIONS")).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("email",email)))).andReturn().getResponse().getStatus();
    }
    int send() throws Exception { return mvc.perform(post("/api/profile/email-verification").with(user("mail.owner").roles("OPERATIONS")).with(csrf())).andReturn().getResponse().getStatus(); }
    int confirm(String code) throws Exception { return mvc.perform(post("/api/profile/email-verification/confirm").with(user("mail.owner").roles("OPERATIONS")).with(csrf())
        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("code",code)))).andReturn().getResponse().getStatus(); }
    String deliveredCode() throws Exception {
        JsonNode messages=null;
        for(int i=0;i<40;i++) {
            var response=client.send(HttpRequest.newBuilder(URI.create(mailUrl("/api/v1/messages"))).GET().build(),HttpResponse.BodyHandlers.ofString());
            messages=json.readTree(response.body()).get("messages");
            if(messages!=null && !messages.isEmpty()) break;
            Thread.sleep(50);
        }
        assertThat(messages).isNotNull(); assertThat(messages.size()).isEqualTo(1);
        var response=client.send(HttpRequest.newBuilder(URI.create(mailUrl("/api/v1/message/"+messages.get(0).get("ID").asText()))).GET().build(),HttpResponse.BodyHandlers.ofString());
        var matcher=Pattern.compile("code is: ([0-9]{6})").matcher(json.readTree(response.body()).get("Text").asText());
        assertThat(matcher.find()).isTrue(); return matcher.group(1);
    }
    interface Work { int run(int index) throws Exception; }
    List<Integer> parallel(int count,Work work) throws Exception {
        var executor=Executors.newFixedThreadPool(count); var start=new CountDownLatch(1); List<Future<Integer>> results=new ArrayList<>();
        try { for(int i=0;i<count;i++) { final int index=i; results.add(executor.submit(() -> { start.await(); return work.run(index); })); }
            start.countDown(); List<Integer> statuses=new ArrayList<>(); for(var result:results) statuses.add(result.get(30,TimeUnit.SECONDS)); return statuses;
        } finally { executor.shutdownNow(); }
    }
    @Test void realSmtpDeliveryAndConfirmationPersistsAcrossRequests() throws Exception {
        assertThat(update("mail.owner","owner@example.test")).isEqualTo(200); assertThat(send()).isEqualTo(200);
        String code=deliveredCode(); assertThat(confirm(code)).isEqualTo(200);
        mvc.perform(get("/api/profile").with(user("mail.owner").roles("OPERATIONS"))).andExpect(status().isOk()).andExpect(jsonPath("$.data.emailVerified").value(true));
        assertThat(confirm(code)).isEqualTo(409);
    }
    @Test void concurrentEmailClaimsProduceOneOwnerAndOneConflict() throws Exception {
        var statuses=parallel(2,index -> update(index==0?"mail.owner":"mail.other","shared@example.test"));
        assertThat(statuses).containsExactlyInAnyOrder(200,409);
        assertThat(users.findAll().stream().filter(user -> "shared@example.test".equals(user.getEmail())).count()).isEqualTo(1);
    }
    @Test void concurrentConfirmationConsumesCodeExactlyOnce() throws Exception {
        update("mail.owner","confirm@example.test"); assertThat(send()).isEqualTo(200); String code=deliveredCode();
        var statuses=parallel(8,index -> confirm(code));
        assertThat(statuses.stream().filter(status -> status==200).count()).isEqualTo(1);
        assertThat(statuses.stream().filter(status -> status==409).count()).isEqualTo(7);
    }
    @Test void concurrentResendsProduceOneEmailAndRateLimitOtherRequests() throws Exception {
        update("mail.owner","resend@example.test"); var statuses=parallel(8,index -> send());
        assertThat(statuses.stream().filter(status -> status==200).count()).isEqualTo(1);
        assertThat(statuses.stream().filter(status -> status==429).count()).isEqualTo(7);
        assertThat(deliveredCode()).hasSize(6);
    }
}
