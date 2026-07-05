using Microsoft.EntityFrameworkCore.Migrations;



#nullable disable



namespace SkySpire.Api.Migrations;



/// <inheritdoc />

public partial class AddCharacters : Migration

{

    /// <inheritdoc />

    protected override void Up(MigrationBuilder migrationBuilder)

    {

        migrationBuilder.CreateTable(

            name: "characters",

            columns: table => new

            {

                Id = table.Column<Guid>(type: "uuid", nullable: false),

                UserId = table.Column<Guid>(type: "uuid", nullable: false),

                SlotIndex = table.Column<int>(type: "integer", nullable: false),

                RaceId = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),

                ClassId = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),

                JsonPath = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),

                Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),

                CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),

                UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)

            },

            constraints: table =>

            {

                table.PrimaryKey("PK_characters", x => x.Id);

                table.ForeignKey(

                    name: "FK_characters_users_UserId",

                    column: x => x.UserId,

                    principalTable: "users",

                    principalColumn: "Id",

                    onDelete: ReferentialAction.Cascade);

            });



        migrationBuilder.CreateIndex(

            name: "IX_characters_UserId_SlotIndex",

            table: "characters",

            columns: new[] { "UserId", "SlotIndex" },

            unique: true);

    }



    /// <inheritdoc />

    protected override void Down(MigrationBuilder migrationBuilder)

    {

        migrationBuilder.DropTable(name: "characters");

    }

}


