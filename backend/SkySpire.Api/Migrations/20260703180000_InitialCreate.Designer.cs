using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SkySpire.Api.Data;

#nullable disable

namespace SkySpire.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260703180000_InitialCreate")]
partial class InitialCreate
{
    /// <inheritdoc />
    protected override void BuildTargetModel(ModelBuilder modelBuilder)
    {
#pragma warning disable 612, 618
        modelBuilder
            .HasAnnotation("ProductVersion", "10.0.0")
            .HasAnnotation("Relational:MaxIdentifierLength", 63);

        NpgsqlModelBuilderExtensions.UseIdentityByDefaultColumns(modelBuilder);

        modelBuilder.Entity("SkySpire.Api.Models.User", b =>
            {
                b.Property<Guid>("Id")
                    .ValueGeneratedOnAdd()
                    .HasColumnType("uuid");

                b.Property<DateTime>("CreatedAt")
                    .HasColumnType("timestamp with time zone");

                b.Property<string>("Email")
                    .IsRequired()
                    .HasMaxLength(256)
                    .HasColumnType("character varying(256)");

                b.Property<DateTime?>("LastLoginAt")
                    .HasColumnType("timestamp with time zone");

                b.Property<string>("PasswordHash")
                    .IsRequired()
                    .HasMaxLength(256)
                    .HasColumnType("character varying(256)");

                b.Property<string>("Username")
                    .IsRequired()
                    .HasMaxLength(32)
                    .HasColumnType("character varying(32)");

                b.HasKey("Id");

                b.HasIndex("Email")
                    .IsUnique();

                b.HasIndex("Username")
                    .IsUnique();

                b.ToTable("users", (string)null);
            });
#pragma warning restore 612, 618
    }
}
