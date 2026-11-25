package com.zhanx.dental.controller;

import com.zhanx.dental.model.ClinicSetting;
import com.zhanx.dental.repository.ClinicSettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/clinic")
@RequiredArgsConstructor
public class ClinicController {

    private final ClinicSettingRepository clinicSettingRepository;

    @GetMapping
    public ResponseEntity<ClinicSetting> getClinic() {
        return ResponseEntity.ok(clinicSettingRepository.findById((short) 1)
                .orElseGet(() -> clinicSettingRepository.save(
                        ClinicSetting.builder()
                                .id((short) 1)
                                .clinicName("ZhanX Dental Care")
                                .build()
                )));
    }

    @PatchMapping
    public ResponseEntity<ClinicSetting> updateClinic(@RequestBody ClinicSetting updates) {
        ClinicSetting current = clinicSettingRepository.findById((short) 1)
                .orElse(ClinicSetting.builder().id((short) 1).build());

        if (updates.getClinicName() != null) current.setClinicName(updates.getClinicName());
        if (updates.getAddress() != null) current.setAddress(updates.getAddress());
        if (updates.getPhone() != null) current.setPhone(updates.getPhone());
        if (updates.getEmail() != null) current.setEmail(updates.getEmail());
        if (updates.getDentistName() != null) current.setDentistName(updates.getDentistName());
        if (updates.getDentistQualification() != null) current.setDentistQualification(updates.getDentistQualification());
        if (updates.getDentistRegistrationNo() != null) current.setDentistRegistrationNo(updates.getDentistRegistrationNo());

        return ResponseEntity.ok(clinicSettingRepository.save(current));
    }
}
