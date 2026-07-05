using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using SkySpire.Api.Data;

#nullable disable

namespace SkySpire.Api.Migrations;

[DbContext(typeof(AppDbContext))]
partial class AppDbContextModelSnapshot : ModelSnapshot
{
    protected override void BuildModel(ModelBuilder modelBuilder)
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

        modelBuilder.Entity("SkySpire.Api.Models.Character", b =>
            {
                b.Property<Guid>("Id")
                    .ValueGeneratedOnAdd()
                    .HasColumnType("uuid");

                b.Property<string>("ClassId")
                    .HasMaxLength(32)
                    .HasColumnType("character varying(32)");

                b.Property<DateTime>("CreatedAt")
                    .HasColumnType("timestamp with time zone");

                b.Property<string>("JsonPath")
                    .IsRequired()
                    .HasMaxLength(512)
                    .HasColumnType("character varying(512)");

                b.Property<string>("RaceId")
                    .HasMaxLength(32)
                    .HasColumnType("character varying(32)");

                b.Property<int>("SlotIndex")
                    .HasColumnType("integer");

                b.Property<string>("Status")
                    .IsRequired()
                    .HasMaxLength(16)
                    .HasColumnType("character varying(16)");

                b.Property<DateTime>("UpdatedAt")
                    .HasColumnType("timestamp with time zone");

                b.Property<Guid>("UserId")
                    .HasColumnType("uuid");

                b.HasKey("Id");

                b.HasIndex("UserId", "SlotIndex")
                    .IsUnique();

                b.ToTable("characters", (string)null);
            });

        modelBuilder.Entity("SkySpire.Api.Models.Character", b =>
            {
                b.HasOne("SkySpire.Api.Models.User", "User")
                    .WithMany()
                    .HasForeignKey("UserId")
                    .OnDelete(DeleteBehavior.Cascade)
                    .IsRequired();

                b.Navigation("User");
            });
#pragma warning restore 612, 618
    }
}
