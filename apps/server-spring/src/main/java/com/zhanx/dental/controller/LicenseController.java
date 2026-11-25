package com.zhanx.dental.controller;

import com.zhanx.dental.service.CloudVerificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/license")
@RequiredArgsConstructor
public class LicenseController {

    private final CloudVerificationService verificationService;

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        return ResponseEntity.ok(verificationService.getCloudVerificationStatus());
    }

    @PostMapping("/activate")
    public ResponseEntity<Map<String, Object>> activate(@RequestBody(required = false) Map<String, Object> req) {
        String clinicName = req != null && req.containsKey("clinicName") ? (String) req.get("clinicName") : null;
        String dentistName = req != null && req.containsKey("dentistName") ? (String) req.get("dentistName") : null;
        Integer months = req != null && req.containsKey("months") ? (Integer) req.get("months") : 12;

        return ResponseEntity.ok(verificationService.activateCloudSubscription(clinicName, dentistName, months));
    }
}
