variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Prefix used for all resource names"
  type        = string
  default     = "products-api"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

variable "lambda_memory_mb" {
  description = "Memory allocated to the API Lambda function"
  type        = number
  default     = 256
}

variable "lambda_timeout_s" {
  description = "Timeout for the API Lambda function in seconds"
  type        = number
  default     = 10
}

variable "jwt_expires_in" {
  description = "JWT lifetime (vercel/ms format, e.g. 1h, 30m)"
  type        = string
  default     = "1h"
}

variable "log_retention_days" {
  description = "CloudWatch log retention"
  type        = number
  default     = 14
}

variable "throttle_rate_limit" {
  description = "Steady-state requests per second allowed by API Gateway"
  type        = number
  default     = 50
}

variable "throttle_burst_limit" {
  description = "Burst requests allowed by API Gateway"
  type        = number
  default     = 100
}

variable "cors_allowed_origins" {
  description = "Origins allowed by CORS"
  type        = list(string)
  default     = ["*"]
}
