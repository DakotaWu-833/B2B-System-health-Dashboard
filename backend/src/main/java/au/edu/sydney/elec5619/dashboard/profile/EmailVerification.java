package au.edu.sydney.elec5619.dashboard.profile;
import java.time.Instant;
import au.edu.sydney.elec5619.dashboard.user.User;
import jakarta.persistence.*;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
@Entity
@Table(name = "email_verifications")
public class EmailVerification {
    @Id @Column(name = "user_id") private Long userId;
    @MapsId @OneToOne(fetch = FetchType.LAZY) @JoinColumn(name = "user_id")
    @OnDelete(action = OnDeleteAction.CASCADE) private User user;
    @Column(nullable = false, length = 254) private String email;
    @Column(name = "code_hash", nullable = false, length = 255) private String codeHash;
    @Column(nullable = false) private int attempts;
    @Column(name = "sent_at", nullable = false) private Instant sentAt;
    @Column(name = "expires_at", nullable = false) private Instant expiresAt;
    @Column(name = "consumed_at") private Instant consumedAt;
    protected EmailVerification() {}
    public EmailVerification(User user) { this.user = user; }
    public void renew(String email, String hash, Instant sent, Instant expires) {
        this.email = email; codeHash = hash; sentAt = sent; expiresAt = expires; consumedAt = null; attempts = 0;
    }
    public String getEmail() { return email; }
    public String getCodeHash() { return codeHash; }
    public int getAttempts() { return attempts; }
    public Instant getSentAt() { return sentAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getConsumedAt() { return consumedAt; }
    public void failAttempt() { attempts++; }
    public void consume(Instant at) { consumedAt = at; }
}
