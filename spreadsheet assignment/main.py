import logging
from  generate_student_records import generate_csv_files

def main() -> None:
    config = {
        "file_prefix": "2024 - Assignment 2 - A1-",
        "start_file_suffix": 23136001,
        "num_files": 105,
        "min_students": 400,
        "max_students": 600,
        "min_subjects": 20,
        "max_subjects": 30,
        "max_marks": 100,
        "absent_probability": 0.25,
        "low_score_probability": 0.4,
    }

    try:
        generate_csv_files(config)
    except Exception as e:
        logging.exception(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    main()
