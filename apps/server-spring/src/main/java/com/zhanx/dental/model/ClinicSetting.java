package com.zhanx.dental.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "clinic_settings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClinicSetting {

    @Id
    @Builder.Default
    private Short id = 1;

    @Column(name = "clinic_name", nullable = false)
    @Builder.Default
    private String clinicName = "ZhanX DentalCare";

    @Column(name = "logo_path")
    private String logoPath;

    private String address;

    private String phone;

    private String email;

    private String website;

    @Column(name = "working_hours", columnDefinition = "jsonb")
    @Builder.Default
    private String workingHours = "{}";

    @Column(nullable = false)
    @Builder.Default
    private String currency = "INR";

    @Column(nullable = false)
    @Builder.Default
    private String timezone = "Asia/Kolkata";

    @Column(name = "receipt_footer")
    private String receiptFooter;

    @Column(name = "prescription_footer")
    private String prescriptionFooter;

    @Column(name = "dentist_name")
    private String dentistName;

    @Column(name = "dentist_qualification")
    private String dentistQualification;

    @Column(name = "dentist_registration_no")
    private String dentistRegistrationNo;

    @Column(name = "dentist_contact")
    private String dentistContact;

    @Column(name = "appointment_slot_minutes", nullable = false)
    @Builder.Default
    private Integer appointmentSlotMinutes = 30;

    @Column(name = "invoice_prefix", nullable = false)
    @Builder.Default
    private String invoicePrefix = "INV-";

    @Column(name = "patient_prefix", nullable = false)
    @Builder.Default
    private String patientPrefix = "P-";

    @Column(name = "prescription_prefix", nullable = false)
    @Builder.Default
    private String prescriptionPrefix = "RX-";

    @Column(name = "lab_module_enabled", nullable = false)
    @Builder.Default
    private Boolean labModuleEnabled = true;

    @Column(name = "tax_enabled", nullable = false)
    @Builder.Default
    private Boolean taxEnabled = false;

    @Column(name = "tax_percent", nullable = false)
    @Builder.Default
    private Double taxPercent = 0.0;

    @Column(name = "subscription_status")
    @Builder.Default
    private String subscriptionStatus = "ACTIVE"; // ACTIVE, TRIAL, EXPIRED for Cloud SaaS

    @Column(name = "subscription_expires_at")
    private OffsetDateTime subscriptionExpiresAt;

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = OffsetDateTime.now();
    }
}
