"""Draw the README's illustrated Atelier example. Requires Pillow."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUTPUT = Path(__file__).resolve().parent
SIZE = (1000, 410)
INK = "#101b1e"
PAPER = "#f4ead7"
MUTED = "#aabbbb"
BRASS = "#d8b77b"
MINT = "#92c5b1"


def font(size, *names):
    folders = [
        Path("/System/Library/Fonts/Supplemental"),
        Path("/usr/share/fonts/truetype/dejavu"),
    ]
    for folder in folders:
        for name in names:
            path = folder / name
            if path.is_file():
                return ImageFont.truetype(str(path), size)
    return ImageFont.load_default(size=size)


TITLE = font(43, "Georgia.ttf", "DejaVuSerif.ttf")
BODY = font(22, "Arial.ttf", "DejaVuSans.ttf")
LABEL = font(16, "Arial Bold.ttf", "DejaVuSans-Bold.ttf")
NUMBER = font(29, "Georgia.ttf", "DejaVuSerif.ttf")
CAPTION = font(24, "Georgia.ttf", "DejaVuSerif.ttf")


def blend(cold, warm, amount):
    """Move one pigment between its unlit and lamplit values."""
    return tuple(round(a + (b - a) * amount) for a, b in zip(cold, warm))


def arch(draw, box, fill):
    x, y, right, bottom = box
    width = right - x
    draw.ellipse((x, y, right, y + width), fill=fill)
    draw.rectangle((x, y + width // 2, right, bottom), fill=fill)


def room(draw, light):
    draw.rounded_rectangle((526, 25, 974, 385), 15, fill="#17292b", outline="#466361")
    draw.rectangle((545, 47, 955, 322), fill="#1a3237")
    draw.rectangle((545, 302, 955, 322), fill="#203431")
    arch(draw, (651, 65, 852, 293), "#386261")
    arch(draw, (658, 73, 845, 285), "#24454f")
    arch(draw, (670, 85, 833, 272), blend((34, 71, 80), (78, 111, 105), light))
    # The valley beyond the three panes.
    draw.polygon([(670, 213), (703, 175), (736, 204), (765, 165), (833, 218),
                  (833, 272), (670, 272)], fill="#395b60")
    draw.polygon([(670, 243), (719, 207), (759, 241), (797, 212), (833, 233),
                  (833, 272), (670, 272)], fill="#304f4d")
    draw.line((752, 86, 752, 275), fill="#3a4341", width=5)
    draw.line((670, 209, 833, 209), fill="#3a4341", width=5)
    draw.line((559, 302, 941, 302), fill="#50615a", width=2)
    # Table, book and recording on its sleeve.
    draw.rounded_rectangle((601, 275, 895, 286), 3, fill="#8f6a49")
    for x in (616, 872):
        draw.rectangle((x, 285, x + 8, 307), fill="#685340")
    draw.line((624, 271, 692, 268), fill="#b39b74", width=3)
    draw.line((624, 275, 698, 273), fill="#a9bba0", width=3)
    if light > 0.3:
        draw.rounded_rectangle((723, 228, 767, 273), 3, fill="#927452", outline=BRASS)
        draw.ellipse((729, 234, 761, 266), fill="#253d3b", outline="#d1b37d")
        draw.ellipse((740, 245, 750, 255), fill="#d9b36e")
    # Reading lamp. Its cone falls across the kept record as the room opens.
    shade = blend((86, 90, 69), (219, 173, 98), light)
    draw.polygon([(801, 237), (834, 237), (874, 273), (751, 273)],
                 fill=blend((43, 69, 62), (126, 112, 65), light))
    draw.line((843, 273, 843, 216, 817, 216), fill="#b59761", width=5, joint="curve")
    draw.polygon([(805, 215), (830, 215), (838, 237), (797, 237)], fill=shade)
    draw.rounded_rectangle((828, 270, 858, 274), 2, fill="#b59761")
    title = "The practice room" if light > 0.5 else "The waiting room"
    draw.text((750, 351), title, fill=PAPER, font=CAPTION, anchor="mm")
    if light > 0.5:
        draw.ellipse((888, 65, 939, 116), outline=BRASS, width=2)
        draw.text((913, 90), "I", fill=BRASS, font=NUMBER, anchor="mm")


def frame(state, minutes, light):
    image = Image.new("RGB", SIZE, INK)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((1, 1, 998, 408), 16, outline="#567065", width=2)
    draw.line((38, 62, 485, 62), fill="#50635c")
    draw.text((40, 31), "ATELIER  /  FIRST RESTORATION", font=LABEL, fill=BRASS)
    titles = ["Before the session", "Twenty-five more", "Keep the recording"]
    notes = ["35 minutes already in the ledger.", "Guitar practice earns 25 character XP.",
             "A finished take goes on the shelf."]
    draw.text((39, 85), titles[state], font=TITLE, fill=PAPER)
    draw.text((42, 145), notes[state], font=BODY, fill=MUTED)
    draw.text((42, 204), "PRACTICE TIME", font=LABEL, fill=MINT)
    draw.text((485, 197), f"{minutes} / 60 min", font=NUMBER, fill=PAPER, anchor="ra")
    draw.rounded_rectangle((42, 238, 486, 248), 5, fill="#2f4745")
    draw.rounded_rectangle((42, 238, 42 + round(444 * minutes / 60), 248), 5, fill=MINT)
    draw.text((42, 293), "FINISHED RESULTS", font=LABEL, fill=BRASS)
    draw.text((485, 286), f"{int(state == 2)} / 1", font=NUMBER, fill=PAPER, anchor="ra")
    draw.rounded_rectangle((42, 326, 486, 336), 5, fill="#3d473d")
    if state == 2:
        draw.rounded_rectangle((42, 326, 486, 336), 5, fill=BRASS)
    room(draw, light)
    return image


def main():
    frames = [frame(0, 35, 0)]
    timing = [1250]
    for minute in (37, 40, 44, 49, 54, 58, 60):
        frames.append(frame(1, minute, 0))
        timing.append(95)
    timing[-1] = 1550
    for step in range(1, 10):
        frames.append(frame(2, 60, step / 9))
        timing.append(95)
    timing[-1] = 2300
    # One run with a final hold. The text and still carry the whole example.
    frames[0].save(OUTPUT / "atelier-first-light.gif", save_all=True,
                   append_images=frames[1:], duration=timing, optimize=True)
    frames[-1].save(OUTPUT / "atelier-still.webp", quality=93, method=6)


if __name__ == "__main__":
    main()
