terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.16"
    }
  }

  required_version = ">= 1.2.0"
}

provider "aws" {
  region = "us-east-2"
}


resource "aws_s3_bucket" "bucket" {
  bucket = "${terraform.workspace}-sota-user-data-private"

  force_destroy = "true"

}

resource "aws_s3_bucket_cors_configuration" "bucket" {
  bucket = aws_s3_bucket.bucket.id

  cors_rule {
    allowed_methods = ["GET", "POST", "PUT"]
    allowed_origins = ["*"]
    allowed_headers = ["*"]

    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }

}

resource "aws_iam_user_policy" "sota_api_file_handler_user_policy" {
  name = "${terraform.workspace}_sota_api_file_handler_user_policy"
  user = aws_iam_user.sota_web.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "s3:PutObject",
          "s3:GetObject"
        ]
        Effect   = "Allow"
        Resource = "${aws_s3_bucket.bucket.arn}/*"
      },
    ]
  })
}

# resource "aws_iam_role" "sota_api_file_handler_role" {
#   name = "sota_api_file_handler"

#   assume_role_policy = jsonencode({
#     Version = "2012-10-17"
#     Statement = [
#       {
#         Action = "sts:AssumeRole"
#         Effect = "Allow"
#         Sid    = ""
#         Principal = {
#           Service = "s3.amazonaws.com"
#         }
#       },
#     ]
#   })
# }

resource "aws_iam_user" "sota_web" {
  name = "sota-web-${terraform.workspace}"


}

resource "aws_iam_access_key" "sota_web" {
  user = aws_iam_user.sota_web.name
}

output "secret" {
  value = aws_iam_access_key.sota_web.encrypted_secret
}
