package dev.microhub.user;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.web.bind.annotation.*;

/** „Mein Konto“ – für jedes angemeldete Mitglied, immer nur das eigene Konto. */
@RestController
@RequestMapping("/api/account")
public class AccountController {

    private final AccountService accountService;

    public AccountController(AccountService accountService) {
        this.accountService = accountService;
    }

    @PutMapping("/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@Valid @RequestBody AccountRequests.ChangePassword request,
                               Authentication authentication, HttpServletRequest httpRequest) {
        accountService.changePassword(authentication.getName(), request);
        // Die Sperre „erst Passwort ändern“ hängt an der Sitzung, siehe MustChangePasswordInterceptor.
        httpRequest.getSession().removeAttribute(MustChangePasswordInterceptor.SESSION_FLAG);
    }

    @PutMapping("/display-name")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changeDisplayName(@Valid @RequestBody AccountRequests.ChangeDisplayName request,
                                  Authentication authentication) {
        accountService.changeDisplayName(authentication.getName(), request);
    }

    /** Löscht das Konto samt eigenen Aushängen und meldet sofort ab. */
    @PostMapping("/delete")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@Valid @RequestBody AccountRequests.DeleteAccount request, Authentication authentication,
                       HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        accountService.delete(authentication.getName(), request);
        new SecurityContextLogoutHandler().logout(httpRequest, httpResponse, authentication);
    }
}
