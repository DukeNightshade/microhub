package dev.microhub.photos;

import dev.microhub.common.BadRequestException;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collection;
import java.util.Iterator;
import java.util.List;
import java.util.UUID;
import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.ImageOutputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Legt Fotos als JPEG-Dateien im Upload-Ordner ab, je einmal groß und als Vorschau.
 *
 * Jedes Bild wird neu kodiert statt die hochgeladene Datei zu übernehmen: Dabei fallen alle
 * Metadaten weg – vor allem der GPS-Standort, den Handyfotos sonst mitbringen (hier: die Wohnadresse).
 * Nebenbei ist so sichergestellt, dass nur echte Bilder auf der Platte landen.
 */
@Component
public class PhotoStorage {

    private static final Logger log = LoggerFactory.getLogger(PhotoStorage.class);

    private static final int FULL_SIZE = 1600;
    private static final int THUMB_SIZE = 600;
    /** Schutz vor „Dekompressionsbomben“: kleine Datei, riesige Pixelzahl, voller Arbeitsspeicher. */
    private static final long MAX_PIXELS = 40_000_000L;
    private static final List<String> ALLOWED_FORMATS = List.of("jpeg", "png");

    private final Path directory;

    public PhotoStorage(@Value("${microhub.upload-dir}") Path directory) throws IOException {
        this.directory = Files.createDirectories(directory.toAbsolutePath().normalize());
        log.info("Fotos werden gespeichert in {}", this.directory);
    }

    public record StoredPhoto(String key, int width, int height) {
    }

    /**
     * Speichert das Bild und gibt den Dateischlüssel zurück. Wird die laufende Transaktion
     * zurückgerollt (z. B. weil der Datenbankeintrag scheitert), werden die Dateien wieder entfernt.
     */
    public StoredPhoto store(InputStream input) throws IOException {
        BufferedImage image = read(input);
        String key = UUID.randomUUID().toString();

        BufferedImage full = scale(image, FULL_SIZE);
        writeJpeg(full, path(key, false), 0.85f);
        writeJpeg(scale(image, THUMB_SIZE), path(key, true), 0.8f);

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    if (status != STATUS_COMMITTED) deleteNow(key);
                }
            });
        }
        return new StoredPhoto(key, full.getWidth(), full.getHeight());
    }

    /** Löscht die Dateien erst, wenn die Datenbank-Änderung wirklich gespeichert ist. */
    public void deleteAfterCommit(Collection<String> keys) {
        if (keys.isEmpty()) return;
        List<String> copy = List.copyOf(keys);
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            copy.forEach(this::deleteNow);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                copy.forEach(PhotoStorage.this::deleteNow);
            }
        });
    }

    public Path path(String key, boolean thumb) {
        // Der Schlüssel stammt immer aus der Datenbank; die Prüfung verhindert trotzdem Pfade wie „../“.
        UUID.fromString(key);
        return directory.resolve(thumb ? key + "_thumb.jpg" : key + ".jpg");
    }

    private void deleteNow(String key) {
        try {
            Files.deleteIfExists(path(key, false));
            Files.deleteIfExists(path(key, true));
        } catch (IOException e) {
            log.warn("Foto {} konnte nicht gelöscht werden", key, e);
        }
    }

    private static BufferedImage read(InputStream input) throws IOException {
        try (ImageInputStream stream = ImageIO.createImageInputStream(input)) {
            Iterator<ImageReader> readers = stream == null ? null : ImageIO.getImageReaders(stream);
            if (readers == null || !readers.hasNext()) {
                throw new BadRequestException("Das ist kein Bild, das MicroHub lesen kann (JPEG oder PNG).");
            }
            ImageReader reader = readers.next();
            try {
                if (!ALLOWED_FORMATS.contains(reader.getFormatName().toLowerCase())) {
                    throw new BadRequestException("Bitte ein Foto als JPEG oder PNG hochladen.");
                }
                reader.setInput(stream, true, true);
                if ((long) reader.getWidth(0) * reader.getHeight(0) > MAX_PIXELS) {
                    throw new BadRequestException("Das Bild ist zu groß.");
                }
                return reader.read(0);
            } catch (IOException e) {
                throw new BadRequestException("Das Bild ist beschädigt oder unvollständig.");
            } finally {
                reader.dispose();
            }
        }
    }

    /** Verkleinert auf die längste Kante, nie vergrößern. Transparenz wird weiß, weil JPEG keine kennt. */
    private static BufferedImage scale(BufferedImage source, int maxEdge) {
        double factor = Math.min(1.0, (double) maxEdge / Math.max(source.getWidth(), source.getHeight()));
        int width = Math.max(1, (int) Math.round(source.getWidth() * factor));
        int height = Math.max(1, (int) Math.round(source.getHeight() * factor));

        BufferedImage target = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = target.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.setColor(Color.WHITE);
            g.fillRect(0, 0, width, height);
            g.drawImage(source, 0, 0, width, height, null);
        } finally {
            g.dispose();
        }
        return target;
    }

    private static void writeJpeg(BufferedImage image, Path target, float quality) {
        ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
        try (ImageOutputStream out = ImageIO.createImageOutputStream(Files.newOutputStream(target))) {
            ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(quality);
            writer.setOutput(out);
            writer.write(null, new IIOImage(image, null, null), param);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        } finally {
            writer.dispose();
        }
    }
}
