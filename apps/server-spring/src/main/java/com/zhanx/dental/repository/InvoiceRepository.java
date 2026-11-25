package com.zhanx.dental.repository;

import com.zhanx.dental.model.Invoice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface InvoiceRepository extends JpaRepository<Invoice, UUID> {
    List<Invoice> findByInvoiceDateBetweenOrderByInvoiceDateDesc(LocalDate startDate, LocalDate endDate);

    @Query("SELECT COALESCE(SUM(i.total), 0) FROM Invoice i WHERE i.invoiceDate = :date AND i.status <> 'void'")
    BigDecimal sumTotalByDate(@Param("date") LocalDate date);

    @Query("SELECT COALESCE(SUM(i.amountPaid), 0) FROM Invoice i WHERE i.invoiceDate = :date AND i.status <> 'void'")
    BigDecimal sumCollectedByDate(@Param("date") LocalDate date);

    @Query("SELECT COALESCE(SUM(i.outstandingBalance), 0) FROM Invoice i WHERE i.status <> 'void'")
    BigDecimal sumTotalOutstanding();
}
