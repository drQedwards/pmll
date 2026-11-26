/* Compile from the repository root:
 *   gcc -std=c11 -Wall -Wextra -Werror -DPMLL_NO_MAIN -I. \
 *       tests/test_silo_embed_text.c PMLL.c -lm -o test_silo_embed_text
 * Finite check only; not a proof of an open problem.
 */
#include "PMLL.h"
#include <math.h>
#include <stdio.h>
#include <string.h>

#define DIM 32

static int fail(const char *msg)
{
    fprintf(stderr, "FAIL: %s\n", msg);
    return 1;
}

int main(void)
{
    float a[DIM], b[DIM];
    int i, nneg, nnz;
    const char *long_tok =
        "super_long_identifier_exceeding_sixty_three_characters_without_splitting_into_two_tokens";
    /* First 63 characters of long_tok (old splitter would hash only this, then the tail). */
    static char head63[64];
    int n;
    for (n = 0; n < 63 && long_tok[n]; n++)
        head63[n] = long_tok[n];
    head63[63] = '\0';

    if ((int)strlen(long_tok) <= 63)
        return fail("fixture token is not longer than 63 characters");
    if ((int)strlen(head63) != 63)
        return fail("63-char prefix fixture is the wrong length");

    silo_embed_text(long_tok, a, DIM);
    silo_embed_text(head63, b, DIM);

    /* The long identifier must not collapse to the 63-char prefix embedding. */
    {
        float acc = 0.0f;
        for (i = 0; i < DIM; i++) {
            float d = a[i] - b[i];
            acc += d * d;
        }
        if (acc < 1e-12f)
            return fail("long token matched the 63-char prefix; splitter still present?");
    }

    /* Determinism */
    silo_embed_text(long_tok, b, DIM);
    for (i = 0; i < DIM; i++) {
        if (a[i] != b[i])
            return fail("embedding is not deterministic");
    }

    /* Signed contributions: some negative mass on a short mixed string. */
    silo_embed_text("alpha beta gamma delta epsilon", a, DIM);
    nneg = 0;
    nnz = 0;
    for (i = 0; i < DIM; i++) {
        if (a[i] < 0.0f)
            nneg++;
        if (fabsf(a[i]) > 1e-12f)
            nnz++;
    }
    if (nnz == 0)
        return fail("embedding was all zeros");
    if (nneg == 0)
        return fail("no negative buckets; unsigned bias still present?");

    printf("PASS silo_embed_text: streaming long token + signed CountSketch\n");
    return 0;
}
