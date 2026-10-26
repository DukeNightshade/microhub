package dev.microhub.user;

import dev.microhub.common.ForbiddenException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Wer sich mit einem Einmal-Passwort vom Admin anmeldet, darf erst weiter, wenn er ein eigenes
 * Passwort gesetzt hat. Das Frontend leitet dorthin; dieser Riegel gilt zusätzlich im Backend,
 * damit das Admin-bekannte Passwort nicht doch weiterbenutzt werden kann.
 * Das Merkmal setzt die SecurityConfig beim Anmelden in die Sitzung.
 */
@Component
public class MustChangePasswordInterceptor implements HandlerInterceptor {

    public static final String SESSION_FLAG = "microhub.mustChangePassword";

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        HttpSession session = request.getSession(false);
        if (session != null && session.getAttribute(SESSION_FLAG) != null) {
            throw new ForbiddenException("Bitte setze zuerst ein eigenes Passwort.");
        }
        return true;
    }
}
