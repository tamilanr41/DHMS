package com.zhanx.dental.controller;

import com.zhanx.dental.model.Appointment;
import com.zhanx.dental.repository.AppointmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/appointments")
@RequiredArgsConstructor
public class AppointmentController {

    private final AppointmentRepository appointmentRepository;

    @GetMapping
    public ResponseEntity<List<Appointment>> getAppointments(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate
    ) {
        if (startDate != null && endDate != null) {
            return ResponseEntity.ok(appointmentRepository.findByAppointmentDateBetweenOrderByAppointmentDateAscStartTimeAsc(startDate, endDate));
        }
        LocalDate queryDate = (date != null) ? date : LocalDate.now();
        return ResponseEntity.ok(appointmentRepository.findByAppointmentDateOrderByStartTimeAsc(queryDate));
    }

    @GetMapping("/queue")
    public ResponseEntity<List<Appointment>> getQueue(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        LocalDate queryDate = (date != null) ? date : LocalDate.now();
        return ResponseEntity.ok(appointmentRepository.findQueueForDate(queryDate));
    }

    @PostMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(
            @PathVariable UUID id,
            @RequestBody Map<String, String> body
    ) {
        String newStatus = body.get("status");
        if (newStatus == null) return ResponseEntity.badRequest().body("Status is required");

        return appointmentRepository.findById(id).map(appointment -> {
            appointment.setStatus(newStatus);
            appointmentRepository.save(appointment);
            return ResponseEntity.ok(appointment);
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }
}
