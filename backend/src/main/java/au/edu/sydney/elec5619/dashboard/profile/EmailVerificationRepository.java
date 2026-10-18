package au.edu.sydney.elec5619.dashboard.profile;
import org.springframework.data.jpa.repository.JpaRepository;
public interface EmailVerificationRepository extends JpaRepository<EmailVerification, Long> {}
