package dev.microhub;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling   // nächtliche Aufräum-Jobs, später auch Push-Erinnerungen
public class MicrohubApplication {

    public static void main(String[] args) {
        SpringApplication.run(MicrohubApplication.class, args);
    }

}
