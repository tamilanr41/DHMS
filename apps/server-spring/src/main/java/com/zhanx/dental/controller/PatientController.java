package com.zhanx.dental.controller;

import com.zhanx.dental.model.Patient;
import com.zhanx.dental.repository.PatientRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/patients")
@RequiredArgsConstructor
public class PatientController {

    private final PatientRepository patientRepository;

    @GetMapping
    public ResponseEntity<List<Patient>> getPatients(
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int pageSize
    ) {
        if (q != null && !q.isBlank()) {
            return ResponseEntity.ok(patientRepository.searchPatients(q.trim()));
        }
        PageRequest pageRequest = PageRequest.of(Math.max(0, page - 1), pageSize, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Patient> patientPage = patientRepository.findAll(pageRequest);
        return ResponseEntity.ok(patientPage.getContent());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Patient> getPatientById(@PathVariable UUID id) {
        Optional<Patient> p = patientRepository.findById(id);
        return p.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Patient> createPatient(@RequestBody Patient patient) {
        if (patient.getPatientNo() == null || patient.getPatientNo().isBlank()) {
            patient.setPatientNo("P-" + System.currentTimeMillis() % 100000);
        }
        Patient saved = patientRepository.save(patient);
        return ResponseEntity.ok(saved);
    }

    @PatchMapping("/{id}")
    public ResponseEntity<Patient> updatePatient(@PathVariable UUID id, @RequestBody Patient updates) {
        return patientRepository.findById(id).map(existing -> {
            if (updates.getFullName() != null) existing.setFullName(updates.getFullName());
            if (updates.getMobile() != null) existing.setMobile(updates.getMobile());
            if (updates.getEmail() != null) existing.setEmail(updates.getEmail());
            if (updates.getAddress() != null) existing.setAddress(updates.getAddress());
            if (updates.getDob() != null) existing.setDob(updates.getDob());
            if (updates.getGender() != null) existing.setGender(updates.getGender());
            if (updates.getNotes() != null) existing.setNotes(updates.getNotes());
            return ResponseEntity.ok(patientRepository.save(existing));
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }
}
