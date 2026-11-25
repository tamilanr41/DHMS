package com.zhanx.dental.controller;

import com.zhanx.dental.model.User;
import com.zhanx.dental.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/auth/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody Map<String, String> creds) {
        String username = creds.get("username");
        String password = creds.get("password");
        return ResponseEntity.ok(authService.login(username, password));
    }

    @GetMapping("/auth/me")
    public ResponseEntity<Map<String, Object>> me(@AuthenticationPrincipal User user) {
        if (user == null) {
            return ResponseEntity.status(401).build();
        }
        Map<String, Object> dto = new HashMap<>();
        dto.put("id", user.getId());
        dto.put("username", user.getUsername());
        dto.put("fullName", user.getFullName());
        dto.put("role", user.getRole() != null ? user.getRole().getCode() : "staff");
        dto.put("roleName", user.getRole() != null ? user.getRole().getName() : "Staff");
        dto.put("email", user.getEmail());
        dto.put("phone", user.getPhone());
        return ResponseEntity.ok(dto);
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> h = new HashMap<>();
        h.put("status", "ok");
        h.put("database", true);
        h.put("framework", "Spring Boot 3.3.5");
        h.put("runtime", "OpenJDK 21");
        h.put("mode", "Cloud SaaS");
        return ResponseEntity.ok(h);
    }
}
