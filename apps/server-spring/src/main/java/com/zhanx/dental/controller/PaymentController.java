package com.zhanx.dental.controller;

import com.zhanx.dental.model.Payment;
import com.zhanx.dental.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

@RestController
@RequestMapping("/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentRepository paymentRepository;

    @GetMapping
    public ResponseEntity<List<Payment>> getPayments(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate
    ) {
        if (startDate != null && endDate != null) {
            OffsetDateTime start = LocalDate.parse(startDate).atStartOfDay().atOffset(OffsetDateTime.now().getOffset());
            OffsetDateTime end = LocalDate.parse(endDate).plusDays(1).atStartOfDay().atOffset(OffsetDateTime.now().getOffset());
            return ResponseEntity.ok(paymentRepository.findByPaymentDateBetweenOrderByPaymentDateDesc(start, end));
        }
        return ResponseEntity.ok(paymentRepository.findAll());
    }
}
