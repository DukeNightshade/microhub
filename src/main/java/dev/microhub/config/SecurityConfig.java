package dev.microhub.config;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                // Frontend, PWA-Dateien und Fehlerseite: für alle
                .requestMatchers("/", "/index.html", "/manifest.json", "/sw.js", "/favicon.ico",
                        "/css/**", "/js/**", "/icons/**", "/error").permitAll()
                .requestMatchers("/api/auth/**", "/actuator/health").permitAll()

                // Gastzugriff: nur lesen
                .requestMatchers(HttpMethod.GET, "/api/news/**", "/api/events/**", "/api/waste/**").permitAll()
                // Kontakte: Gäste sehen nur die öffentlichen, das filtert der ContactService
                .requestMatchers(HttpMethod.GET, "/api/contacts/**").permitAll()

                // Nur für eingeloggte Benutzer
                .requestMatchers("/api/board/**", "/api/push/**").authenticated()

                // Inhalte pflegen: nur Admins
                .requestMatchers("/api/news/**", "/api/events/**", "/api/waste/**", "/api/contacts/**").hasRole("ADMIN")

                .anyRequest().authenticated())

            // Login per fetch() aus JS: liefert Statuscodes statt Weiterleitungen
            .formLogin(form -> form
                .loginProcessingUrl("/api/auth/login")
                .successHandler((req, res, auth) -> res.setStatus(HttpServletResponse.SC_OK))
                .failureHandler((req, res, ex) -> res.setStatus(HttpServletResponse.SC_UNAUTHORIZED))
                .permitAll())
            .logout(logout -> logout
                .logoutUrl("/api/auth/logout")
                .logoutSuccessHandler(new HttpStatusReturningLogoutSuccessHandler(HttpStatus.NO_CONTENT)))

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
    PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }
}
