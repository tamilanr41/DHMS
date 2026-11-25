package com.zhanx.dental.service;

import com.zhanx.dental.model.User;
import com.zhanx.dental.repository.UserRepository;
import com.zhanx.dental.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public Map<String, Object> login(String username, String password) {
        if (username == null || password == null || username.isBlank() || password.isBlank()) {
            throw new IllegalArgumentException("Username and password are required");
        }

        Optional<User> userOpt = userRepository.findByUsernameIgnoreCase(username.trim());
        if (userOpt.isEmpty()) {
            throw new IllegalArgumentException("Invalid username or password");
        }

        User user = userOpt.get();
        if (!user.getIsActive()) {
            throw new IllegalStateException("Your account has been deactivated. Contact clinic administrator.");
        }

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            user.setFailedLoginAttempts(user.getFailedLoginAttempts() + 1);
            userRepository.save(user);
            throw new IllegalArgumentException("Invalid username or password");
        }

        // Reset failed attempts on success
        user.setFailedLoginAttempts(0);
        user.setLastLoginAt(OffsetDateTime.now());
        userRepository.save(user);

        String roleCode = user.getRole() != null ? user.getRole().getCode() : "staff";
        String token = jwtService.generateToken(user.getUsername(), roleCode, user.getId().toString(), new HashMap<>());

        Map<String, Object> resp = new HashMap<>();
        resp.put("token", token);
        resp.put("accessToken", token);

        Map<String, Object> userDto = new HashMap<>();
        userDto.put("id", user.getId());
        userDto.put("username", user.getUsername());
        userDto.put("fullName", user.getFullName());
        userDto.put("role", roleCode);
        userDto.put("roleName", user.getRole() != null ? user.getRole().getName() : "Staff");
        userDto.put("email", user.getEmail());
        userDto.put("phone", user.getPhone());
        userDto.put("mustChangePassword", user.getMustChangePassword());

        resp.put("user", userDto);
        return resp;
    }
}
