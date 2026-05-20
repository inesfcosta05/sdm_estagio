try {
    $response = Invoke-WebRequest -Uri 'http://localhost:3001/api/fichas' -UseBasicParsing
    $data = $response.Content
    Write-Host "✅ Fichas obtidas com sucesso:"
    Write-Host $data.Substring(0, [Math]::Min(500, $data.Length))
    Write-Host ""
    Write-Host "Total de caracteres: $($data.Length)"
} catch {
    Write-Host "❌ Erro: $($_.Exception.Message)"
}
