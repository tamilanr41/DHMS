package com.zhanx.dental.repository;

import com.zhanx.dental.model.Appointment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface AppointmentRepository extends JpaRepository<Appointment, UUID> {
    List<Appointment> findByAppointmentDateOrderByStartTimeAsc(LocalDate date);

    List<Appointment> findByAppointmentDateBetweenOrderByAppointmentDateAscStartTimeAsc(LocalDate startDate, LocalDate endDate);

    @Query("SELECT a FROM Appointment a WHERE a.appointmentDate = :date AND a.status IN ('checked_in', 'waiting', 'in_consultation') ORDER BY a.startTime ASC")
    List<Appointment> findQueueForDate(@Param("date") LocalDate date);

    long countByAppointmentDate(LocalDate date);

    long countByAppointmentDateAndStatus(LocalDate date, String status);
}
