package au.edu.sydney.elec5619.dashboard.user;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select u from User u where u.username = :username")
    Optional<User> findByUsernameForUpdate(@org.springframework.data.repository.query.Param("username") String username);

    boolean existsByEmailAndIdNot(String email, Long id);

    boolean existsByUsername(String username);
}
