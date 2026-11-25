package com.zhanx.dental.repository;

import com.zhanx.dental.model.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, UUID> {
    List<Payment> findByPaymentDateBetweenOrderByPaymentDateDesc(OffsetDateTime start, OffsetDateTime end);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM Payment p WHERE p.paymentDate >= :start AND p.paymentDate < :end AND p.status = 'completed'")
    BigDecimal sumAmountBetween(@Param("start") OffsetDateTime start, @Param("end") OffsetDateTime end);
}
