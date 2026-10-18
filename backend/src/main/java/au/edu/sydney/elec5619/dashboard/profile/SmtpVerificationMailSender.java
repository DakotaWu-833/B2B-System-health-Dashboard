package au.edu.sydney.elec5619.dashboard.profile;
import au.edu.sydney.elec5619.dashboard.common.ApiProblemException;
import org.springframework.http.HttpStatus;
import org.springframework.mail.*;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;
@Component
public class SmtpVerificationMailSender implements VerificationMailSender {
    private final JavaMailSender mail;
    private final EmailVerificationProperties properties;
    public SmtpVerificationMailSender(JavaMailSender mail, EmailVerificationProperties properties) { this.mail = mail; this.properties = properties; }
    public void send(String email, String code) {
        if (!properties.enabled()) throw new ApiProblemException(HttpStatus.SERVICE_UNAVAILABLE, "Email delivery is not configured");
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(properties.from()); message.setTo(email);
        message.setSubject("Verify your System Health email address");
        message.setText("Your verification code is: " + code + "\nIt expires in " + properties.ttl().toMinutes() + " minutes. If you did not request this, ignore this message.");
        try { mail.send(message); }
        catch (MailException failure) { throw new ApiProblemException(HttpStatus.SERVICE_UNAVAILABLE, "Unable to send verification email; please retry later"); }
    }
}
