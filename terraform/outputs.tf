output "api_url" {
  description = "Base URL of the deployed API"
  value       = aws_apigatewayv2_api.http.api_endpoint
}

output "docs_url" {
  description = "Swagger UI"
  value       = "${aws_apigatewayv2_api.http.api_endpoint}/docs"
}

output "lambda_function_name" {
  value = aws_lambda_function.api.function_name
}

output "products_table" {
  value = aws_dynamodb_table.products.name
}

output "users_table" {
  value = aws_dynamodb_table.users.name
}
