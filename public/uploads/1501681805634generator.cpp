#include <cmath>
#include <cstdlib>
#include <iostream>
#include <string>
#include <vector>
using namespace std;

void progressSequence(string &seq) {
    string newStr;
    int location = 0;
    while (location != string::npos) {
        char cur = seq[location];
        int end = seq.find_first_not_of(cur, location);
        char dist = end == string::npos ? seq.size() - location + '0' : end - location + '0';
        newStr.push_back(dist);
        newStr.push_back(cur);
        location = end;
    }
    seq = newStr;
}

int main(int argc, char** argv){
    int seqA = atoi(argv[1]), aQuer = atoi(argv[2]), aMoves = atoi(argv[3]),  bLen = atoi(argv[4]), bQuer = atoi(argv[5]),
    bMoves = atoi(argv[6]), seed = atoi(argv[7]);
    srand(seed);
    char task = seed % 2 ? 'a' : 'b';
    cout << task << "\n";
    if (task == 'a') {
        int seqlen = rand() % seqA + 1, queries = rand() % aQuer + 1;
        for (int a = 0; a < seqlen; ++a)
            cout << rand() % 9 + 1;
        cout << "\n" << queries << "\n";
        while (queries--)
            cout << rand() % aMoves + 1 << "\n";
    } else {
        int queries = rand() % bQuer + 1, baseseq = rand() % bLen + 1;
        cout << queries << "\n";
        string seq;
        while (1) {
            seq = string(baseseq, ' ');
            for (int b = 0; b < floor(baseseq / 2); ++b)
                seq[b] = seq[baseseq - b - 1] = rand() % 9 + 1 + '0';
            if (baseseq % 2)
                seq[(baseseq - 1) / 2] = rand() % 9 + 1 + '0';
            if (seq == string(seq[0] - '0', seq[0]))
                break;
        }
        vector<string> stor(bMoves + 1);
        for (int a = 1; a <= bMoves; ++a) {
            progressSequence(seq);
            stor[a] = seq;
        }
        while (queries--)
            cout << stor[rand() % bMoves + 1] << "\n";
    }
    return 0;
}