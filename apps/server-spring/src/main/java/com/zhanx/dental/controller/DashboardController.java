package com.zhanx.dental.controller;

import com.zhanx.dental.model.Appointment;
import com.zhanx.dental.repository.AppointmentRepository;
import com.zhanx.dental.repository.InvoiceRepository;
import com.zhanx.dental.repository.PatientRepository;
import com.zhanx.dental.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;

@RestController
@RequestMapping("/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final PatientRepository patientRepository;
    private final AppointmentRepository appointmentRepository;
    private final InvoiceRepository invoiceRepository;
    private final PaymentRepository paymentRepository;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getDashboardData() {
        LocalDate today = LocalDate.now();
        OffsetDateTime startOfDay = today.atStartOfDay().atOffset(OffsetDateTime.now().getOffset());
        OffsetDateTime endOfDay = today.plusDays(1).atStartOfDay().atOffset(OffsetDateTime.now().getOffset());

        long totalPatients = patientRepository.count();
        long todaySchedule = appointmentRepository.countByAppointmentDate(today);
        List<Appointment> queue = appointmentRepository.findQueueForDate(today);
        BigDecimal todayCollections = paymentRepository.sumAmountBetween(startOfDay, endOfDay);
        BigDecimal totalOutstanding = invoiceRepository.sumTotalOutstanding();

        List<Appointment> todayVisits = appointmentRepository.findByAppointmentDateOrderByStartTimeAsc(today);

        Map<String, Object> resp = new HashMap<>();
        resp.put("totalPatients", totalPatients);
        resp.put("todaySchedule", todaySchedule);
        resp.put("queueCount", queue.size());
        resp.put("todayCollections", todayCollections != null ? todayCollections : BigDecimal.ZERO);
        resp.put("outstandingDues", totalOutstanding != null ? totalOutstanding : BigDecimal.ZERO);
        resp.put("activeChairs", Math.min(queue.size(), 4));
        resp.put("todayAppointments", todayVisits);
        resp.put("queue", queue);

        return ResponseEntity.ok(resp);
    }
}
