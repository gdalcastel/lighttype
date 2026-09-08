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
            "Não foi possível ocar esta letra no tamanho atual.",
            suggestion="Aumente a altura da letra ou reduza a espessura da parede.",
            letter=letter,
        )
    if "boolean" in text or "manifold" in text or "topology" in text or "union" in text:
        return GeometryError(
            "Não foi possível criar esta letra no tamanho atual.",
            suggestion="Tente uma fonte mais simples, maior altura ou parede mais fina.",
            letter=letter,
        )
    if "triangul" in text or "earcut" in text or "extrude" in text:
        return GeometryError(
            "O contorno desta letra é complexo demais para o tamanho atual.",
            suggestion="Aumente a altura da letra ou escolha outra fonte.",
            letter=letter,
        )
    return GeometryError(
        "Não foi possível criar esta letra no tamanho atual.",
        suggestion="Aumente a altura da letra ou reduza a espessura da parede.",
        letter=letter,
    )
