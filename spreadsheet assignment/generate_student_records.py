import csv
import random
import os
from typing import List, Dict, Any
import logging
from student_names import student_names
from subjects_pool import subjects_pool

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def generate_marks(num_students: int, num_subjects: int, config: Dict[str, Any]) -> List[List[str]]:
    marks_data = []

    for _ in range(num_students):
        row = []
        for _ in range(num_subjects):
            if random.random() < config["absent_probability"]:
                row.append("A")
            else:
                mark = random.randint(0, config["max_marks"])

                if mark >= config["max_marks"] / 2 and random.random() < config["low_score_probability"]:
                    mark = random.randint(0, config["max_marks"] // 2)

                row.append(str(mark))
        marks_data.append(row)

    return marks_data

def ensure_output_directory(output_dir: str) -> None:
    """Ensure that the output directory exists, create it if it doesn't."""
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        logging.info(f"Created output directory: {output_dir}")
        
def generate_csv_files(config: Dict[str, Any]) -> None:
    output_dir = os.path.join(os.getcwd(), "output")
    ensure_output_directory(output_dir)

    for i in range(config["num_files"]):
        num_students = random.randint(config["min_students"], config["max_students"])
        num_subjects = random.randint(config["min_subjects"], config["max_subjects"])
        subjects = random.sample(subjects_pool, num_subjects)

        selected_students = random.sample(
            student_names * ((num_students // len(student_names)) + 1), num_students
        )

        marks = generate_marks(num_students, num_subjects, config)

        csv_file_name = f"{config['file_prefix']}{config['start_file_suffix'] + i}.csv"
        csv_file_path = os.path.join(output_dir, csv_file_name)


        try:
            with open(csv_file_path, "w", newline="") as csvfile:
                csv_writer = csv.writer(csvfile)

                header = ["Name"] + subjects
                csv_writer.writerow(header)

                for idx, student_name in enumerate(selected_students):
                    csv_writer.writerow([student_name] + marks[idx])

            logging.info(f"Successfully generated {csv_file_name}")
        except IOError as e:
            logging.error(f"Error writing to file {csv_file_name}: {e}")
