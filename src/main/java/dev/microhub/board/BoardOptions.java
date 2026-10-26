package dev.microhub.board;

import java.util.List;

/** Auswahlwerte für das Formular, damit Arten und Laufzeiten nur im Backend gepflegt werden. */
public record BoardOptions(List<KindOption> kinds, List<Integer> durations, int defaultDuration) {

    public record KindOption(BoardKind value, String label) {

        static KindOption from(BoardKind kind) {
            return new KindOption(kind, kind.getLabel());
        }
    }
}
