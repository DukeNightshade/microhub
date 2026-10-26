package dev.microhub.config;

import dev.microhub.user.AppUserRepository;
import dev.microhub.user.MustChangePasswordInterceptor;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.session.SessionRegistry;
import org.springframework.security.core.session.SessionRegistryImpl;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.session.HttpSessionEventPublisher;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, AppUserRepository userRepository,
                                            SessionRegistry sessionRegistry) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                // Frontend, PWA-Dateien und Fehlerseite: für alle
                .requestMatchers("/", "/index.html", "/manifest.json", "/sw.js", "/favicon.ico",
                        "/css/**", "/js/**", "/icons/**", "/fonts/**", "/error").permitAll()
                // Login, Login-Status und Registrierung mit Freischaltcode
                .requestMatchers("/api/auth/**", "/actuator/health").permitAll()

                // Gastzugriff: nur lesen
                .requestMatchers(HttpMethod.GET, "/api/news/**", "/api/events/**", "/api/waste/**",
                        "/api/calendar/**").permitAll()
                // Kontakte: Gäste sehen nur die öffentlichen, das filtert der ContactService
                .requestMatchers(HttpMethod.GET, "/api/contacts/**").permitAll()

                // Nur für eingeloggte Benutzer
                .requestMatchers("/api/board/**", "/api/push/**", "/api/account/**").authenticated()

                // Inhalte pflegen und Verwaltung: nur Admins
                .requestMatchers("/api/news/**", "/api/events/**", "/api/waste/**", "/api/contacts/**",
                        "/api/admin/**").hasRole("ADMIN")

                .anyRequest().authenticated())

            // Login per fetch() aus JS: liefert Statuscodes statt Weiterleitungen
            .formLogin(form -> form
                .loginProcessingUrl("/api/auth/login")
                .successHandler((req, res, auth) -> {
                    // Einmal-Passwort vom Admin? Dann sperrt der MustChangePasswordInterceptor alles
                    // außer dem Ändern des Passworts, bis ein eigenes gesetzt ist.
                    userRepository.findByUsernameIgnoreCase(auth.getName())
                            .filter(user -> user.isMustChangePassword())
                            .ifPresent(user -> req.getSession().setAttribute(MustChangePasswordInterceptor.SESSION_FLAG, true));
                    res.setStatus(HttpServletResponse.SC_OK);
                })
                // Bewusst ohne Unterscheidung zwischen falschem Passwort und gesperrtem Konto:
                // sonst ließe sich ohne Passwort herausfinden, welche Benutzernamen es gibt.
                .failureHandler((req, res, ex) -> res.setStatus(HttpServletResponse.SC_UNAUTHORIZED))
                .permitAll())
            .logout(logout -> logout
                .logoutUrl("/api/auth/logout")
                .logoutSuccessHandler(new HttpStatusReturningLogoutSuccessHandler(HttpStatus.NO_CONTENT)))

            // Alle Sitzungen merken, damit Sperren, Rollenwechsel und Passwort-Reset sofort wirken
            // (SessionTerminator). Eine abgelaufene Sitzung antwortet wie „nicht angemeldet“.
            .sessionManagement(session -> session
                .maximumSessions(-1)
                .sessionRegistry(sessionRegistry)
                .expiredSessionStrategy(event -> event.getResponse().setStatus(HttpServletResponse.SC_UNAUTHORIZED)))

            // Nicht eingeloggt → 401 statt Weiterleitung auf eine Login-Seite
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))

            // CSRF-Schutz: Token im Cookie XSRF-TOKEN, JS schickt es im Header X-XSRF-TOKEN zurück
            .csrf(csrf -> csrf
                .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()));

        return http.build();
    }

    @Bean
    SessionRegistry sessionRegistry() {
        return new SessionRegistryImpl();
    }

    /** Meldet beendete Sitzungen an das SessionRegistry, sonst wächst es endlos. */
    @Bean
    HttpSessionEventPublisher httpSessionEventPublisher() {
        return new HttpSessionEventPublisher();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }
}
