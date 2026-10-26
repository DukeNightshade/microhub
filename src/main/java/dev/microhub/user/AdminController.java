package dev.microhub.user;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** Verwaltung: Freischaltcodes und Mitglieder. Nur für Admins (SecurityConfig: /api/admin/**). */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService adminService;

    public AdminController(AdminService adminService) {
        this.adminService = adminService;
    }

    @GetMapping("/codes")
    public List<AdminDtos.CodeItem> codes() {
        return adminService.codes();
    }

    @PostMapping("/codes")
    @ResponseStatus(HttpStatus.CREATED)
    public List<AdminDtos.CodeItem> createCodes(@Valid @RequestBody AdminDtos.CreateCodes request) {
        return adminService.createCodes(request);
    }

    @PutMapping("/codes/{id}")
    public AdminDtos.CodeItem updateCode(@PathVariable long id, @RequestBody AdminDtos.UpdateCode request) {
        return adminService.updateCode(id, request);
    }

    @GetMapping("/members")
    public List<AdminDtos.MemberItem> members(Authentication authentication) {
        return adminService.members(authentication.getName());
    }

    @PutMapping("/members/{id}")
    public AdminDtos.MemberItem updateMember(@PathVariable long id, @RequestBody AdminDtos.UpdateMember request,
                                             Authentication authentication) {
        return adminService.updateMember(id, request, authentication.getName());
    }

    @PostMapping("/members/{id}/password-reset")
    public AdminDtos.PasswordReset resetPassword(@PathVariable long id) {
        return adminService.resetPassword(id);
    }
}
