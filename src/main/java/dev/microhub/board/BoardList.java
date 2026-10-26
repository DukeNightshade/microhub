package dev.microhub.board;

import java.util.List;

/** Das Brett: was hängt, und darunter die eigenen abgelaufenen Aushänge, die sich noch retten lassen. */
public record BoardList(List<BoardItem> active, List<BoardItem> expired) {
}
