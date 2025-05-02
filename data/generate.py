#!/usr/bin/env python3
import random

WIDTH = 500
HEIGHT = 500
CONTRIB_WEIGHTS = [0.5, 0.2, 0.15, 0.10, 0.05]

def weighted_random_value() -> str:
    return str(random.choices(population=[0, 1, 2, 3, 4], weights=CONTRIB_WEIGHTS)[0])

def generate_map(width: int, height: int) -> None:
    with open("map.txt", "w") as f:
        for _ in range(height):
            row = "".join(weighted_random_value() for _ in range(width))
            f.write(row + "\n")

if __name__ == "__main__":
    generate_map(WIDTH, HEIGHT)
    print(f"Generated {HEIGHT}×{WIDTH} contribution map in map.txt.")
