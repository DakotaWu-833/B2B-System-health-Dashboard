package au.edu.sydney.elec5619.dashboard.metric;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface MetricRepository extends JpaRepository<Metric, Long> {

    @Query("""
            select m from Metric m where not exists (
                select newer.id from Metric newer
                where newer.monitoredSystem = m.monitoredSystem
                and (newer.recordedAt > m.recordedAt
                    or (newer.recordedAt = m.recordedAt and newer.id > m.id)))
            """)
    List<Metric> findLatestForAllSystems();

    @Query("""
            select m from Metric m where m.monitoredSystem.id in :ids and not exists (
                select newer.id from Metric newer where newer.monitoredSystem = m.monitoredSystem
                and (newer.recordedAt > m.recordedAt or (newer.recordedAt = m.recordedAt and newer.id > m.id)))
            """)
    List<Metric> findLatestForSystems(@org.springframework.data.repository.query.Param("ids") java.util.Collection<Long> ids);

    List<Metric> findTop100ByMonitoredSystemIdOrderByRecordedAtDescIdDesc(Long systemId);

    @Query("""
            select m from Metric m where m.monitoredSystem.id = :systemId
            and m.recordedAt >= :from and m.recordedAt <= :to
            and (m.recordedAt < :beforeTime or (m.recordedAt = :beforeTime and m.id < :beforeId))
            order by m.recordedAt desc, m.id desc
            """)
    List<Metric> history(@org.springframework.data.repository.query.Param("systemId") Long systemId,
                        @org.springframework.data.repository.query.Param("from") java.time.Instant from,
                        @org.springframework.data.repository.query.Param("to") java.time.Instant to,
                        @org.springframework.data.repository.query.Param("beforeTime") java.time.Instant beforeTime,
                        @org.springframework.data.repository.query.Param("beforeId") Long beforeId,
                        org.springframework.data.domain.Pageable limit);

    @Query("""
            select m from Metric m where m.recordedAt < :cutoff and exists (
                select newer.id from Metric newer where newer.monitoredSystem = m.monitoredSystem
                and (newer.recordedAt > m.recordedAt or (newer.recordedAt = m.recordedAt and newer.id > m.id)))
            order by m.id
            """)
    List<Metric> retentionCandidates(@org.springframework.data.repository.query.Param("cutoff") java.time.Instant cutoff,
                                     org.springframework.data.domain.Pageable limit);

    @Query("""
            select count(m) from Metric m where m.recordedAt < :cutoff and exists (
                select newer.id from Metric newer where newer.monitoredSystem = m.monitoredSystem
                and (newer.recordedAt > m.recordedAt or (newer.recordedAt = m.recordedAt and newer.id > m.id)))
            """)
    long countRetentionCandidates(@org.springframework.data.repository.query.Param("cutoff") java.time.Instant cutoff);

    Optional<Metric> findFirstByMonitoredSystemIdOrderByRecordedAtDescIdDesc(Long systemId);

    List<Metric> findTop100ByMonitoredSystemIdOrderByRecordedAtDesc(Long systemId);

    Optional<Metric> findFirstByMonitoredSystemIdOrderByRecordedAtDesc(Long systemId);
}
