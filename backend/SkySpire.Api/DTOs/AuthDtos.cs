using System.ComponentModel.DataAnnotations;



namespace SkySpire.Api.DTOs;



public record RegisterRequest

{

    [Required(ErrorMessage = "Informe o e-mail.")]

    [EmailAddress(ErrorMessage = "E-mail inválido.")]

    [MaxLength(256, ErrorMessage = "E-mail muito longo.")]

    public required string Email { get; init; }



    [Required(ErrorMessage = "Informe o usuário.")]

    [MinLength(3, ErrorMessage = "O usuário deve ter no mínimo 3 caracteres.")]

    [MaxLength(32, ErrorMessage = "O usuário deve ter no máximo 32 caracteres.")]

    [RegularExpression(@"^[a-zA-Z0-9_]+$", ErrorMessage = "Use apenas letras, números e underscore.")]

    public required string Username { get; init; }



    [Required(ErrorMessage = "Informe a senha.")]

    [MinLength(8, ErrorMessage = "A senha deve ter no mínimo 8 caracteres.")]

    [MaxLength(128, ErrorMessage = "A senha deve ter no máximo 128 caracteres.")]

    public required string Password { get; init; }



    [Required(ErrorMessage = "Confirme a senha.")]

    [Compare(nameof(Password), ErrorMessage = "As senhas não coincidem.")]

    public required string ConfirmPassword { get; init; }

}



public record LoginRequest

{

    [Required(ErrorMessage = "Informe o e-mail ou usuário.")]

    [MaxLength(256)]

    public required string Login { get; init; }



    [Required(ErrorMessage = "Informe a senha.")]

    [MaxLength(128)]

    public required string Password { get; init; }

}



public record UserDto(Guid Id, string Email, string Username, DateTime CreatedAt);



public record AuthResponse(string Token, DateTime ExpiresAt, UserDto User);



public record ErrorResponse(string Message, IReadOnlyDictionary<string, string[]>? Errors = null);

