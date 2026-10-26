package dev.microhub.config;

import dev.microhub.user.MustChangePasswordInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final MustChangePasswordInterceptor mustChangePasswordInterceptor;

    public WebConfig(MustChangePasswordInterceptor mustChangePasswordInterceptor) {
        this.mustChangePasswordInterceptor = mustChangePasswordInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // Erreichbar bleiben: Login-Status/Abmelden und das Ändern des Passworts selbst.
        registry.addInterceptor(mustChangePasswordInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns("/api/auth/**", "/api/account/password");
    }
}
