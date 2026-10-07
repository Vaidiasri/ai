import { describe, expect, it } from "vitest";
import { toPublicDoctor } from "./doctors";

const row = {
  id: "d1",
  name: "Dr A",
  speciality: "Orthodontics",
  bio: null,
  imageUrl: "/a.png",
  gender: "FEMALE" as const,
  clinicId: "c1",
  phone: "+91 90000 00000",
  clinicName: "Smile Clinic",
  branchName: "Main",
  distance: Math.PI, // 3.14159...
  // a column the mapper must never pass through, even if a query returns it
  email: "doc@example.com",
};

describe("toPublicDoctor", () => {
  it.each([true, false])("never returns email (includePhone=%s)", (flag) => {
    expect(toPublicDoctor(row, flag)).not.toHaveProperty("email");
  });

  it("returns phone only with the flag", () => {
    expect(toPublicDoctor(row, true).phone).toBe(row.phone);
    expect(toPublicDoctor(row, false)).not.toHaveProperty("phone");
  });

  it("gives null distance when there is no location", () => {
    expect(toPublicDoctor({ ...row, distance: null }, false).distance).toBeNull();
  });

  it("rounds distance to one decimal", () => {
    expect(toPublicDoctor(row, false).distance).toBe(3.1);
    // raw SQL can hand back a numeric as a string
    expect(
      toPublicDoctor({ ...row, distance: "12.96" as unknown as number }, false)
        .distance,
    ).toBe(13);
    expect(toPublicDoctor({ ...row, distance: 0 }, false).distance).toBe(0);
  });

  it("returns exactly the allowlisted keys", () => {
    expect(Object.keys(toPublicDoctor(row, true)).sort()).toEqual(
      [
        "bio",
        "branchName",
        "clinicId",
        "clinicName",
        "distance",
        "gender",
        "id",
        "imageUrl",
        "name",
        "phone",
        "speciality",
      ].sort(),
    );
  });
});
