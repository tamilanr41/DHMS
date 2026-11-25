package com.zhanx.dental.repository;

import com.zhanx.dental.model.Patient;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PatientRepository extends JpaRepository<Patient, UUID> {
    Optional<Patient> findByPatientNo(String patientNo);

    @Query("SELECT p FROM Patient p WHERE " +
           "LOWER(p.fullName) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "p.patientNo LIKE CONCAT('%', :query, '%') OR " +
           "p.mobile LIKE CONCAT('%', :query, '%')")
    List<Patient> searchPatients(@Param("query") String query);

    @Query("SELECT p FROM Patient p WHERE " +
           "(:query IS NULL OR :query = '' OR LOWER(p.fullName) LIKE LOWER(CONCAT('%', :query, '%')) OR p.patientNo LIKE CONCAT('%', :query, '%') OR p.mobile LIKE CONCAT('%', :query, '%'))")
    Page<Patient> findPatientsFiltered(@Param("query") String query, Pageable pageable);
}
