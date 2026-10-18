package au.edu.sydney.elec5619.dashboard.profile;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.time.Duration;
import au.edu.sydney.elec5619.dashboard.common.ApiProblemException;
import org.junit.jupiter.api.Test;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

class SmtpVerificationMailSenderTests {
    @Test void disabledDeliveryFailsClearlyWithoutSending() {
        var transport = mock(JavaMailSender.class);
        var sender = new SmtpVerificationMailSender(transport, properties(false));
        assertThatThrownBy(() -> sender.send("local@example.test", "123456")).isInstanceOf(ApiProblemException.class)
            .hasMessage("Email delivery is not configured");
        verifyNoInteractions(transport);
    }
    @Test void transportFailureDoesNotExposeSmtpDetails() {
        var transport = mock(JavaMailSender.class);
        doThrow(new MailSendException("private provider diagnostic")).when(transport).send(any(SimpleMailMessage.class));
        var sender = new SmtpVerificationMailSender(transport, properties(true));
        assertThatThrownBy(() -> sender.send("local@example.test", "123456")).isInstanceOf(ApiProblemException.class)
            .hasMessage("Unable to send verification email; please retry later");
    }
    EmailVerificationProperties properties(boolean enabled) {
        return new EmailVerificationProperties(enabled, "no-reply@example.test", Duration.ofMinutes(15), Duration.ofMinutes(1), 5);
    }
}
