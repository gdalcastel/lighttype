"""Human-readable geometry failures. Never leak raw stack traces to the UI."""


class GeometryError(Exception):
    def __init__(self, message: str, suggestion: str | None = None, letter: str | None = None):
        super().__init__(message)
        self.message = message
        self.suggestion = suggestion
        self.letter = letter

    def to_dict(self) -> dict:
        payload = {"message": self.message}
        if self.suggestion:
            payload["suggestion"] = self.suggestion
        if self.letter:
            payload["letter"] = self.letter
        return payload


class UnsupportedCharacterError(GeometryError):
    pass


class ValidationError(GeometryError):
    pass


def friendly_from_exception(exc: Exception, letter: str | None = None) -> GeometryError:
    if isinstance(exc, GeometryError):
        return exc
    text = str(exc).lower()
    if "buffer" in text or "empty" in text or "offset" in text:
        return GeometryError(
            "We couldn't hollow this letter at the current size.",
            suggestion="Try increasing the letter height or reducing the wall thickness.",
            letter=letter,
        )
    if "boolean" in text or "manifold" in text or "topology" in text or "union" in text:
        return GeometryError(
            "We couldn't create this letter at the current size.",
            suggestion="Try a simpler font, a larger height, or a thinner wall.",
            letter=letter,
        )
    if "triangul" in text or "earcut" in text or "extrude" in text:
        return GeometryError(
            "This letter's outline is too detailed to turn into a solid at the current size.",
            suggestion="Try increasing the letter height or choosing another font.",
            letter=letter,
        )
    return GeometryError(
        "We couldn't create this letter at the current size.",
        suggestion="Try increasing the letter height or reducing the wall thickness.",
        letter=letter,
    )
