package com.zhanx.dental.service;

import com.zhanx.dental.model.ClinicSetting;
import com.zhanx.dental.repository.ClinicSettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CloudVerificationService {

    private final ClinicSettingRepository clinicSettingRepository;

    @Value("${app.cloud.enforce-subscription:false}")
    private boolean enforceSubscription;

    public Map<String, Object> getCloudVerificationStatus() {
        ClinicSetting setting = clinicSettingRepository.findById((short) 1)
                .orElseGet(() -> clinicSettingRepository.save(
                        ClinicSetting.builder()
                                .id((short) 1)
                                .clinicName("ZhanX Dental Care")
                                .subscriptionStatus("ACTIVE")
                                .subscriptionExpiresAt(OffsetDateTime.now().plusYears(1))
                                .build()
                ));

        boolean isActive = true;
        String reason = null;
        String message = null;

        if (enforceSubscription && setting.getSubscriptionExpiresAt() != null) {
            if (setting.getSubscriptionExpiresAt().isBefore(OffsetDateTime.now())) {
                isActive = false;
                reason = "SUBSCRIPTION_EXPIRED";
                message = "Your cloud clinic subscription has expired. Please renew your plan.";
            }
        }

        Map<String, Object> resp = new HashMap<>();
        resp.put("activated", isActive);
        resp.put("cloudDeployment", true);
        resp.put("productName", "ZhanX DentalCare Cloud");
        resp.put("reason", reason);
        resp.put("message", message);
        resp.put("setupRequired", false);

        Map<String, Object> licenseInfo = new HashMap<>();
        licenseInfo.put("licenseId", "CLOUD-SAAS-" + setting.getClinicName().replaceAll("[^a-zA-Z0-9]", "").toUpperCase());
        licenseInfo.put("clinicName", setting.getClinicName());
        licenseInfo.put("dentistName", setting.getDentistName() != null ? setting.getDentistName() : "Chief Dental Surgeon");
        licenseInfo.put("licenseType", "cloud_subscription");
        licenseInfo.put("subscriptionStatus", setting.getSubscriptionStatus());
        licenseInfo.put("expiresAt", setting.getSubscriptionExpiresAt() != null ? setting.getSubscriptionExpiresAt().toString() : null);
        licenseInfo.put("features", new String[]{"*"});

        resp.put("license", licenseInfo);
        return resp;
    }

    public Map<String, Object> activateCloudSubscription(String clinicName, String dentistName, Integer durationMonths) {
        ClinicSetting setting = clinicSettingRepository.findById((short) 1)
                .orElse(ClinicSetting.builder().id((short) 1).build());

        if (clinicName != null && !clinicName.isBlank()) {
            setting.setClinicName(clinicName.trim());
        }
        if (dentistName != null && !dentistName.isBlank()) {
            setting.setDentistName(dentistName.trim());
        }
        int months = (durationMonths != null && durationMonths > 0) ? durationMonths : 12;
        setting.setSubscriptionStatus("ACTIVE");
        setting.setSubscriptionExpiresAt(OffsetDateTime.now().plusMonths(months));
        clinicSettingRepository.save(setting);

        return getCloudVerificationStatus();
    }
}
