package com.zhanx.dental.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "payments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "payment_no", nullable = false, unique = true)
    private String paymentNo;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "invoice_id", nullable = false)
    private Invoice invoice;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "patient_id", nullable = false)
    private Patient patient;

    @Column(nullable = false)
    private BigDecimal amount;

    @Column(nullable = false)
    private String method; // Cash, UPI, Card, Bank Transfer

    @Column(name = "transaction_ref")
    private String transactionRef;

    @Column(name = "payment_date", nullable = false)
    @Builder.Default
    private OffsetDateTime paymentDate = OffsetDateTime.now();

    @Column(nullable = false)
    @Builder.Default
    private String status = "completed"; // completed, void

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
